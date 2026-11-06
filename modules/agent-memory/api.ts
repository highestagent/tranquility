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

interface MemorySession {
  client: MemWal
  namespace: string
}

let account: MemoryAccount | null = null
let session: Promise<MemorySession> | null = null

export function setMemoryAccount(next: MemoryAccount | null) {
  account = next
  session = null
}

export function getMemoryUserId() {
  return account?.userId ?? null
}

/** No one is signed in. Nothing to do until someone is. */
export class NotSignedInError extends Error {}

/** The forget counter is the only thing about memory this app's server keeps. */
async function epochRequest(action: "info" | "forget") {
  const token = await account?.getToken()
  if (!token) throw new NotSignedInError()

  const response = await fetch(`/api/memory/${action}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Memory request failed: ${response.status}`)
  return (await response.json()) as { epoch: number }
}

/** Loaded on demand, since the Sui libraries are too heavy for every page. */
async function openSession(current: MemoryAccount): Promise<MemorySession> {
  const [{ MemWal }, { connectMemoryAccount }, { toSuiWallet }, { epoch }] =
    await Promise.all([
      import("@mysten-incubation/memwal"),
      import("./provision"),
      import("./wallet"),
      epochRequest("info"),
    ])
  const serverUrl = `${window.location.origin}${PROXY_PATH}`
  const wallet = toSuiWallet(await current.getWallet())
  const { accountId, key } = await connectMemoryAccount(wallet, serverUrl)
  return {
    client: MemWal.create({ key, accountId, serverUrl }),
    // Forgetting moves to a new namespace, since Walrus Memory has no delete.
    namespace: `tranquility-${epoch}`,
  }
}

function getSession() {
  if (!account) return Promise.reject(new NotSignedInError())
  session ??= openSession(account).catch((error: unknown) => {
    session = null
    throw error
  })
  return session
}

export interface RecalledMemory {
  text: string
  at: string | null
}

function failAfter(ms: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timed out")), ms)
  })
}

/**
 * Takes the closest matches with no minimum score. Everything in here is this
 * person's own notes, and a broad question like "what do you remember about me?"
 * scores poorly against all of them despite being the one they most need to hear.
 */
async function recall(query: string, limit: number) {
  const { client, namespace } = await getSession()
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
    await getSession()
  },
  /** What the account holds, across every device, not just this browser. */
  count: async () => {
    const { client, namespace } = await getSession()
    const { namespaces } = await client.listNamespaces()
    return namespaces.find(({ name }) => name === namespace)?.memory_count ?? 0
  },
  remember: async (texts: string[]) => {
    const { client, namespace } = await getSession()
    const { job_ids } = await client.rememberBulkAsync(
      texts.map((text) => ({ text, namespace }))
    )
    return { jobIds: job_ids }
  },
  status: async (jobIds: string[]) => {
    const { client } = await getSession()
    const { results } = await client.getRememberBulkStatus(jobIds)
    return {
      jobs: results.map(({ job_id, status }) => ({
        jobId: job_id,
        status: status as string,
      })),
    }
  },
  /** The budget covers everything, including connecting for the first time. */
  recall: (query: string, limit: number, timeoutMs: number) =>
    Promise.race([recall(query, limit), failAfter(timeoutMs)]),
  forget: async () => {
    await epochRequest("forget")
    session = null
  },
}

export type MemoryApi = typeof memoryApi
