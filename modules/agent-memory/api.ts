import type { MemWal, MemorySummary } from "@mysten-incubation/memwal"

import {
  APP_PREFIX,
  memoryPrefix,
  readCatalog,
  RESEARCH_NAMESPACE,
  type Catalog,
  type Fact,
  type MemoryReference,
} from "./records"

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

/** One recalled note, with where it's stored. */
export interface RecallHit {
  blobId: string
  text: string
  /** Lower is closer. */
  distance: number
}

/**
 * What the account holds right now. The inventory is listed when it opens, so
 * a forget or a correction on another device is honored even when this
 * browser was already open.
 */
export interface MemoryWorkspace {
  epoch: number
  catalog: Catalog
  /** The text of one exact revision. */
  read(reference: MemoryReference): Promise<string>
  /** Saved findings, closest first, with no minimum score. */
  search(query: string, limit: number): Promise<RecallHit[]>
}

function accountCheck() {
  const owner = getMemoryUserId()
  return () => {
    if (owner !== getMemoryUserId()) throw new NotSignedInError()
  }
}

/** Every memory the account holds, from every epoch, without reading any. */
async function listInventory(client: MemWal, assertAccount: () => void) {
  const rows: MemorySummary[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await client.listMemories({ cursor, limit: 500 })
    assertAccount()
    rows.push(...page.memories)
    if (!page.has_more) return rows
    if (!page.next_cursor || page.next_cursor === cursor) {
      throw new Error("The memory inventory stopped advancing")
    }
    cursor = page.next_cursor
  }
}

async function openWorkspace(): Promise<MemoryWorkspace> {
  const assertAccount = accountCheck()
  const [client, epoch] = await Promise.all([getClient(), epochRequest("info")])
  assertAccount()
  const rows = await listInventory(client, assertAccount)

  const recall = async (query: string, namespace: string, limit: number) => {
    const { results } = await client.recall({ query, namespace, limit })
    assertAccount()
    return results.map(({ blob_id, text, distance }): RecallHit => ({
      blobId: blob_id,
      text,
      distance,
    }))
  }

  return {
    epoch,
    catalog: readCatalog(rows, epoch),
    async read(reference) {
      // The namespace holds this one revision, so any query finds it. Retries
      // can leave more than one copy, so match the exact blob.
      const hits = await recall("Tranquility record", reference.namespace, 10)
      const match = hits.find(({ blobId }) => blobId === reference.blobId)
      if (!match) throw new Error("A saved memory is unavailable")
      return match.text
    },
    // No minimum score: a broad question like "what do you remember about me?"
    // scores poorly against every note despite being the one most worth answering.
    search: (query, limit) =>
      recall(
        query.slice(0, MAX_QUERY_LENGTH),
        `${memoryPrefix(epoch)}${RESEARCH_NAMESPACE}`,
        limit
      ),
  }
}

/** The blob behind every memory Tranquility saved, forgotten ones included. */
export async function listSavedBlobIds() {
  const assertAccount = accountCheck()
  const client = await getClient()
  assertAccount()
  return new Set(
    (await listInventory(client, assertAccount))
      .filter(({ namespace_id }) => namespace_id.startsWith(APP_PREFIX))
      .map(({ blob_id }) => blob_id)
  )
}

/** The signed-in person's Sui wallet, which owns the blobs their memories are in. */
export async function getSuiWallet() {
  const assertAccount = accountCheck()
  if (!account) throw new NotSignedInError()
  const [{ toSuiWallet }, wallet] = await Promise.all([
    import("./wallet"),
    account.getWallet(),
  ])
  assertAccount()
  return toSuiWallet(wallet)
}

export interface MemoryApi {
  /** Creates the wallet and Walrus Memory account if they don't exist yet. */
  open(): Promise<MemoryWorkspace>
  remember(facts: readonly Fact[], epoch: number): Promise<{ jobIds: string[] }>
  status(
    jobIds: string[]
  ): Promise<{ jobs: { jobId: string; status: string }[] }>
  forget(): Promise<number>
}

export const memoryApi: MemoryApi = {
  open: openWorkspace,
  remember: async (facts, epoch) => {
    const client = await getClient()
    const { job_ids } = await client.rememberBulkAsync(
      facts.map(({ text, namespace }) => ({
        text,
        namespace: `${memoryPrefix(epoch)}${namespace}`,
      }))
    )
    return { jobIds: job_ids }
  },
  status: async (jobIds) => {
    const client = await getClient()
    const { results } = await client.getRememberBulkStatus(jobIds)
    return {
      jobs: results.map(({ job_id, status }) => ({ jobId: job_id, status })),
    }
  },
  forget: () => epochRequest("forget"),
}
