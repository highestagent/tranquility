import { fromBase64 } from "@mysten/sui/utils"

import { getSuiWallet, listSavedBlobIds } from "./api"
import { RELAYER_URL } from "./relayer"
import { forgetMemories } from "./sync"
import { signPersonalMessage, signTransaction, type SuiWallet } from "./wallet"

/**
 * Permanent deletion, through Walrus Memory's Security Delete API. Each memory
 * is a Walrus blob object owned by the person's wallet: the relayer prepares
 * and pays for a transaction deleting a batch of them, and the wallet signs it.
 *
 * This calls the relayer directly rather than through this app's proxy. These
 * routes accept any origin, so the wallet's deletion token never passes
 * through this app's server.
 */

type Action = "REAUTH" | "REFETCH" | "RE_PREPARE" | "RETRY_AFTER" | "NONE"

export class DeletionError extends Error {
  constructor(
    readonly code: string,
    readonly action: Action,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

export interface DeletionDeps {
  relayerUrl: string
  fetch: (url: string, init: RequestInit) => Promise<Response>
  sleep: (ms: number) => Promise<void>
}

const defaultDeps: DeletionDeps = {
  relayerUrl: RELAYER_URL,
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** The relayer caps a batch at 900, since a 1,000-object transaction is too big. */
const MAX_BATCH = 900
const LIST_PAGE = 200
const REQUEST_TIMEOUT_MS = 15_000
/** Submitting waits for the transaction to execute on Sui. */
const SUBMIT_TIMEOUT_MS = 120_000
const STATUS_POLL_MS = 3_000
const STATUS_POLLS = 40
/** Tokens last 45 minutes. Renew a little early. */
const TOKEN_MARGIN_MS = 60_000

type BatchState =
  "awaiting_signature" | "executing" | "completed" | "failed" | "rolled_back"

export interface Excluded {
  blobId: string
  reason: "already_deleted" | "expired" | "not_owner"
}

interface Prepared {
  batchId: string | null
  txBytes: string | null
  included: number
  excluded: Excluded[]
}

interface BatchStatus {
  state: BatchState
  blobCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function malformed(): never {
  throw new DeletionError(
    "INVALID_RESPONSE",
    "NONE",
    "Walrus Memory sent an unexpected response."
  )
}

/** One wallet's session with the deletion API. */
export function deletionClient(
  wallet: SuiWallet,
  deps: DeletionDeps = defaultDeps
) {
  let token: { value: string; expiresAt: number } | null = null

  async function request(
    path: string,
    init: { method?: string; body?: unknown; token?: string } = {},
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json" }
    if (init.body !== undefined) headers["content-type"] = "application/json"
    if (init.token) headers.authorization = `Bearer ${init.token}`
    let response: Response
    try {
      response = await deps.fetch(`${deps.relayerUrl}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new DeletionError(
        "NETWORK_ERROR",
        "RETRY_AFTER",
        "Couldn't reach Walrus Memory."
      )
    }
    const body: unknown = await response.json().catch(() => null)
    if (response.ok) return body
    const error = isRecord(body) && isRecord(body.error) ? body.error : null
    throw new DeletionError(
      typeof error?.code === "string" ? error.code : `HTTP_${response.status}`,
      typeof error?.action === "string" ? (error.action as Action) : "NONE",
      typeof error?.message === "string"
        ? error.message
        : "Walrus Memory refused the request.",
      isRecord(error?.details) ? error.details : {}
    )
  }

  /** Proves the wallet is signing in, by signing the exact challenge text. */
  async function authenticate() {
    const challenge = await request("/api/security-delete-auth/challenge", {
      body: { address: wallet.address },
    })
    if (
      !isRecord(challenge) ||
      typeof challenge.challengeId !== "string" ||
      typeof challenge.challenge !== "string"
    )
      malformed()
    const signature = await signPersonalMessage(
      wallet,
      new TextEncoder().encode(challenge.challenge)
    )
    const verified = await request("/api/security-delete-auth/verify", {
      body: {
        challengeId: challenge.challengeId,
        address: wallet.address,
        signature,
      },
    })
    if (
      !isRecord(verified) ||
      typeof verified.token !== "string" ||
      typeof verified.expiresInSecs !== "number"
    )
      malformed()
    token = {
      value: verified.token,
      expiresAt: Date.now() + verified.expiresInSecs * 1000,
    }
    return token.value
  }

  async function authed(
    path: string,
    init: { method?: string; body?: unknown } = {},
    timeoutMs?: number
  ) {
    const current =
      token && token.expiresAt - Date.now() > TOKEN_MARGIN_MS
        ? token.value
        : await authenticate()
    try {
      return await request(path, { ...init, token: current }, timeoutMs)
    } catch (error) {
      if (!(error instanceof DeletionError) || error.action !== "REAUTH")
        throw error
      return request(path, { ...init, token: await authenticate() }, timeoutMs)
    }
  }

  return {
    /** Every blob of this wallet's that can be deleted now, and the batch limit. */
    async listDeletable() {
      const blobIds: string[] = []
      let batchMax = MAX_BATCH
      let cursor: string | null = null
      do {
        const query = new URLSearchParams({
          state: "deletable",
          limit: String(LIST_PAGE),
        })
        if (cursor) query.set("cursor", cursor)
        const page = await authed(`/api/security-deletable-blobs?${query}`)
        if (
          !isRecord(page) ||
          !Array.isArray(page.items) ||
          !isRecord(page.limits) ||
          (page.nextCursor !== null && typeof page.nextCursor !== "string")
        )
          malformed()
        for (const item of page.items) {
          if (!isRecord(item) || typeof item.blobId !== "string") malformed()
          if (item.state === "deletable") blobIds.push(item.blobId)
        }
        if (typeof page.limits.deleteBatchMax === "number") {
          batchMax = Math.min(batchMax, page.limits.deleteBatchMax)
        }
        // A cursor that doesn't move would loop forever.
        if (page.nextCursor !== null && page.nextCursor === cursor) malformed()
        cursor = page.nextCursor as string | null
      } while (cursor)
      return { blobIds, batchMax: Math.max(1, batchMax) }
    },

    async prepare(blobIds: readonly string[]): Promise<Prepared> {
      const prepared = await authed("/api/security-deletions", {
        body: { mode: "selection", blobIds },
      })
      if (
        !isRecord(prepared) ||
        (prepared.batchId === null) !== (prepared.txBytes === null) ||
        typeof prepared.included !== "number" ||
        !Array.isArray(prepared.excluded)
      )
        malformed()
      return prepared as unknown as Prepared
    },

    async submit(batchId: string, signature: string) {
      const result = await authed(
        `/api/security-deletions/${encodeURIComponent(batchId)}/submit`,
        { body: { signature } },
        SUBMIT_TIMEOUT_MS
      )
      if (!isRecord(result) || typeof result.deleted !== "number") malformed()
      return { deleted: result.deleted }
    },

    async status(batchId: string): Promise<BatchStatus> {
      const status = await authed(
        `/api/security-deletions/${encodeURIComponent(batchId)}`
      )
      if (
        !isRecord(status) ||
        typeof status.state !== "string" ||
        typeof status.blobCount !== "number"
      )
        malformed()
      return status as unknown as BatchStatus
    },

    /** Releases a prepared batch that won't be signed. */
    async cancel(batchId: string) {
      await authed(`/api/security-deletions/${encodeURIComponent(batchId)}`, {
        method: "DELETE",
      })
    },
  }
}

export type DeletionClient = ReturnType<typeof deletionClient>

export interface DeletionResult {
  deleted: number
  /** Gone already, about to expire anyway, or no longer this wallet's. */
  excluded: Excluded[]
  /** Submitted, but Sui hadn't confirmed them yet. */
  unconfirmed: number
}

/** Waits out a submit whose outcome is unknown, without preparing it again. */
async function settleBatch(
  client: DeletionClient,
  batchId: string,
  deps: DeletionDeps
) {
  for (let poll = 0; poll < STATUS_POLLS; poll++) {
    const status = await client.status(batchId).catch(() => null)
    if (status && status.state !== "executing") return status
    await deps.sleep(STATUS_POLL_MS)
  }
  return null
}

async function deleteBatch(
  client: DeletionClient,
  wallet: SuiWallet,
  blobIds: readonly string[],
  deps: DeletionDeps,
  result: DeletionResult
) {
  let prepared: Prepared
  try {
    prepared = await client.prepare(blobIds)
  } catch (error) {
    // Something changed since listing: leave out what's no longer deletable.
    const conflicting =
      error instanceof DeletionError && error.code === "BATCH_CONFLICT"
        ? error.details.conflictingBlobIds
        : null
    if (!Array.isArray(conflicting)) throw error
    const remaining = blobIds.filter((id) => !conflicting.includes(id))
    if (remaining.length === 0) return
    prepared = await client.prepare(remaining)
  }
  result.excluded.push(...prepared.excluded)
  if (!prepared.batchId || !prepared.txBytes) return
  const { batchId, txBytes } = prepared

  let signature: string
  try {
    signature = await signTransaction(wallet, fromBase64(txBytes))
  } catch (error) {
    await client.cancel(batchId).catch(() => undefined)
    throw error
  }

  try {
    result.deleted += (await client.submit(batchId, signature)).deleted
  } catch (error) {
    const uncertain =
      error instanceof DeletionError &&
      (error.code === "RPC_UNAVAILABLE" || error.code === "NETWORK_ERROR")
    if (!uncertain) throw error
    const status = await settleBatch(client, batchId, deps)
    if (!status) {
      result.unconfirmed += prepared.included
    } else if (status.state === "completed") {
      result.deleted += status.blobCount
    } else if (status.state === "awaiting_signature") {
      // The submit never reached Sui. Release the batch so it can be retried.
      await client.cancel(batchId).catch(() => undefined)
      throw error
    } else {
      throw new DeletionError(
        "BATCH_FAILED",
        "RE_PREPARE",
        "Walrus Memory couldn't finish deleting."
      )
    }
  }
}

/** Deletes exactly these blobs, in batches the relayer accepts. */
export async function deleteBlobs(
  client: DeletionClient,
  wallet: SuiWallet,
  blobIds: readonly string[],
  batchMax: number,
  options: {
    deps?: DeletionDeps
    onProgress?: (done: number, total: number) => void
  } = {}
): Promise<DeletionResult> {
  const deps = options.deps ?? defaultDeps
  const result: DeletionResult = { deleted: 0, excluded: [], unconfirmed: 0 }
  for (let start = 0; start < blobIds.length; start += batchMax) {
    await deleteBatch(
      client,
      wallet,
      blobIds.slice(start, start + batchMax),
      deps,
      result
    )
    options.onProgress?.(
      Math.min(start + batchMax, blobIds.length),
      blobIds.length
    )
  }
  return result
}

/** Of what Tranquility saved, what the relayer will delete now. */
export async function findDeletable(
  client: DeletionClient,
  saved: ReadonlySet<string>
) {
  const { blobIds, batchMax } = await client.listDeletable()
  // Only this app's memories, even if the wallet ever holds other blobs.
  return { blobIds: blobIds.filter((id) => saved.has(id)), batchMax }
}

let session: { address: string; client: DeletionClient } | null = null

async function signedInClient() {
  const wallet = await getSuiWallet()
  if (session?.address !== wallet.address) {
    session = { address: wallet.address, client: deletionClient(wallet) }
  }
  return { wallet, client: session.client }
}

export interface DeletionCheck {
  /** Everything saved, in every epoch, forgotten or not. */
  saved: number
  deletable: string[]
  batchMax: number
}

/** How much of what's saved can be permanently deleted right now. */
export async function checkPermanentDeletion(): Promise<DeletionCheck> {
  const [{ client }, saved] = await Promise.all([
    signedInClient(),
    listSavedBlobIds(),
  ])
  const { blobIds, batchMax } = await findDeletable(client, saved)
  return { saved: saved.size, deletable: blobIds, batchMax }
}

/**
 * Forgets first, so nothing is recalled while blobs are deleted or if some
 * can't be, then deletes what the check found.
 */
export async function deletePermanently(
  check: DeletionCheck,
  onProgress?: (done: number, total: number) => void
) {
  await forgetMemories()
  const { wallet, client } = await signedInClient()
  return deleteBlobs(client, wallet, check.deletable, check.batchMax, {
    onProgress,
  })
}
