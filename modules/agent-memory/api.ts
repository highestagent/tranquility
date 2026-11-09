import type { MemWal } from "@mysten-incubation/memwal"

const PROXY_PATH = "/api/walrus"
const MAX_QUERY_LENGTH = 300

/** The signed-in person's wallet, as the account module gets it from Privy. */
export interface AccountWallet {
  address: string
  publicKey?: string
  signRawHash(hash: `0x${string}`): Promise<`0x${string}`>
}

/** The signed-in account, set by the account module. */
interface MemoryAccount {
  userId: string
  getToken: () => Promise<string | null>
  getWallet: () => Promise<AccountWallet>
}

let account: MemoryAccount | null = null
let clientPromise: Promise<MemWal> | null = null

export function setMemoryAccount(next: MemoryAccount | null) {
  if (account?.userId !== next?.userId) clientPromise = null
  account = next
}

export function getMemoryUserId() {
  return account?.userId ?? null
}

/** No one is signed in. Nothing to do until someone is. */
export class NotSignedInError extends Error {}

/** The forget counter is the only thing about memory this app's server keeps. */
async function epochRequest(action: "info" | "forget") {
  const owner = getMemoryUserId()
  const token = await account?.getToken()
  if (!token || owner !== getMemoryUserId()) throw new NotSignedInError()

  const response = await fetch(`/api/memory/${action}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Memory request failed: ${response.status}`)
  const { epoch } = (await response.json()) as { epoch: number }
  if (owner !== getMemoryUserId()) throw new NotSignedInError()
  if (!Number.isSafeInteger(epoch) || epoch < 0)
    throw new Error("Invalid memory epoch")
  return epoch
}

/** Loaded on demand, since the Sui libraries are too heavy for every page. */
async function openClient(current: MemoryAccount): Promise<MemWal> {
  const [{ MemWal }, { connectMemoryAccount }, { toSuiWallet }] =
    await Promise.all([
      import("@mysten-incubation/memwal"),
      import("./provision"),
      import("./wallet"),
    ])
  const serverUrl = `${window.location.origin}${PROXY_PATH}`
  const wallet = toSuiWallet(await current.getWallet())
  if (current.userId !== getMemoryUserId()) throw new NotSignedInError()
  const { accountId, key } = await connectMemoryAccount(wallet, serverUrl)
  return MemWal.create({ key, accountId, serverUrl })
}

async function getClient() {
  if (!account) throw new NotSignedInError()
  const owner = account.userId
  const pending = (clientPromise ??= openClient(account))
  try {
    const client = await pending
    if (owner !== getMemoryUserId()) throw new NotSignedInError()
    return client
  } catch (error) {
    if (clientPromise === pending) clientPromise = null
    throw error
  }
}

// Refresh the namespace before reading or starting a sync pass so a forget
// on another device is honored even when this browser is already open.
async function getMemoryContext() {
  const owner = getMemoryUserId()
  const [client, epoch] = await Promise.all([getClient(), epochRequest("info")])
  if (owner !== getMemoryUserId()) throw new NotSignedInError()
  return { client, epoch, namespace: namespaceFor(epoch) }
}

function namespaceFor(epoch: number) {
  return `tranquility-${epoch}`
}

export interface RecalledMemory {
  text: string
  at: string | null
}

/**
 * Takes the closest matches with no minimum score. Everything in here is this
 * person's own notes, and a broad question like "what do you remember about me?"
 * scores poorly against all of them despite being the one they most need to hear.
 */
async function recall(query: string, limit: number) {
  const { client, namespace } = await getMemoryContext()
  const { results } = await client.recall(query.slice(0, MAX_QUERY_LENGTH), {
    limit,
    namespace,
  })
  return {
    memories: results.map(({ text, created_at }): RecalledMemory => ({
      text,
      at: created_at ?? null,
    })),
  }
}

export const memoryApi = {
  /** Creates the wallet and Walrus Memory account if they don't exist yet. */
  connect: async () => {
    return (await getMemoryContext()).epoch
  },
  /** What the account holds, across every device, not just this browser. */
  count: async () => {
    const { client, namespace } = await getMemoryContext()
    const { namespaces } = await client.listNamespaces()
    return namespaces.find(({ name }) => name === namespace)?.memory_count ?? 0
  },
  remember: async (texts: string[], epoch: number) => {
    const client = await getClient()
    const namespace = namespaceFor(epoch)
    const { job_ids } = await client.rememberBulkAsync(
      texts.map((text) => ({ text, namespace }))
    )
    return { jobIds: job_ids }
  },
  status: async (jobIds: string[]) => {
    const client = await getClient()
    const { results } = await client.getRememberBulkStatus(jobIds)
    return {
      jobs: results.map(({ job_id, status }) => ({
        jobId: job_id,
        status: status as string,
      })),
    }
  },
  /** The budget covers everything, including connecting for the first time. */
  recall: async (query: string, limit: number, timeoutMs: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        recall(query, limit),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Timed out")), timeoutMs)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  },
  forget: () => epochRequest("forget"),
}

export type MemoryApi = typeof memoryApi
