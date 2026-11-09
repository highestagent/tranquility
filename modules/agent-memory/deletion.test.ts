import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { toBase64, toHex } from "@mysten/sui/utils"
import {
  verifyPersonalMessageSignature,
  verifyTransactionSignature,
} from "@mysten/sui/verify"
import { describe, expect, it, vi } from "vitest"

import {
  deleteBlobs,
  deletionClient,
  findDeletable,
  type DeletionDeps,
} from "./deletion"
import { toSuiWallet } from "./wallet"

const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(3))
const address = keypair.getPublicKey().toSuiAddress()

/** Signs like Privy: exactly the bytes it's given. */
const wallet = toSuiWallet({
  address,
  publicKey: toHex(keypair.getPublicKey().toRawBytes()),
  signRawHash: async (hash) =>
    `0x${toHex(await keypair.sign(Uint8Array.from(Buffer.from(hash.slice(2), "hex"))))}`,
})

type Reply = { status?: number; body: unknown }

/** Every field the deletion client sends, across all its requests. */
type RequestBody = {
  address: string
  challengeId: string
  signature: string
  blobIds: string[]
}

function error(status: number, code: string, action: string, details = {}) {
  return {
    status,
    body: { error: { code, action, retriable: false, message: code, details } },
  }
}

/**
 * The relayer's Security Delete API, checking signatures the way it does:
 * the challenge as a personal message, the batch as transaction data.
 */
function fakeRelayer(
  options: {
    deletable?: string[]
    batchMax?: number
    excluded?: Record<string, "already_deleted" | "expired" | "not_owner">
    /** Handles a request before the default behavior, to inject failures. */
    override?: (path: string) => Reply | undefined
  } = {}
) {
  const deletable = new Set(options.deletable ?? [])
  const batches = new Map<
    string,
    { blobs: string[]; tx: Uint8Array; state: string }
  >()
  const deleted: string[] = []
  const challenges = new Map<string, string>()
  let tokens = 0
  let next = 0
  const valid = new Set<string>()

  const handle = async (
    path: string,
    method: string,
    body: RequestBody,
    auth: string | null
  ): Promise<Reply> => {
    const overridden = options.override?.(path)
    if (overridden) return overridden
    if (path === "/api/security-delete-auth/challenge") {
      const id = `c${next++}`
      const challenge = `MemWal security deletion auth\naddress: ${body.address}\nnonce: ${id}`
      challenges.set(id, challenge)
      return { body: { challengeId: id, challenge, expiresInSecs: 300 } }
    }
    if (path === "/api/security-delete-auth/verify") {
      const challenge = challenges.get(body.challengeId)
      challenges.delete(body.challengeId)
      if (!challenge) return error(401, "AUTH_CHALLENGE_EXPIRED", "REAUTH")
      await verifyPersonalMessageSignature(
        new TextEncoder().encode(challenge),
        body.signature,
        { address }
      )
      const token = `t${tokens++}`
      valid.add(token)
      return { body: { token, expiresInSecs: 2700 } }
    }
    if (!auth || !valid.has(auth.replace("Bearer ", ""))) {
      return error(401, "AUTH_TOKEN_EXPIRED", "REAUTH")
    }
    if (path.startsWith("/api/security-deletable-blobs")) {
      const query = new URL(`http://x${path}`).searchParams
      const all = [...deletable]
      const start = Number(query.get("cursor") ?? 0)
      const page = all.slice(start, start + 2)
      return {
        body: {
          items: page.map((blobId) => ({
            blobId,
            objectId: "0x1",
            createdAt: "2026-11-01T00:00:00Z",
            state: "deletable",
          })),
          counts: {},
          limits: { deleteBatchMax: options.batchMax ?? 900 },
          nextCursor: start + 2 < all.length ? String(start + 2) : null,
        },
      }
    }
    if (path === "/api/security-deletions" && method === "POST") {
      const conflicting = body.blobIds.filter(
        (id: string) => !deletable.has(id)
      )
      if (conflicting.length)
        return error(409, "BATCH_CONFLICT", "REFETCH", {
          conflictingBlobIds: conflicting,
        })
      const excluded = body.blobIds
        .filter((id: string) => options.excluded?.[id])
        .map((blobId: string) => ({
          blobId,
          reason: options.excluded![blobId],
        }))
      const included = body.blobIds.filter(
        (id: string) => !options.excluded?.[id]
      )
      if (included.length === 0)
        return {
          body: {
            batchId: null,
            txBytes: null,
            included: 0,
            excluded,
            expiresAt: null,
          },
        }
      const batchId = `b${next++}`
      const tx = new TextEncoder().encode(`delete ${included.join(",")}`)
      batches.set(batchId, { blobs: included, tx, state: "awaiting_signature" })
      return {
        body: {
          batchId,
          txBytes: toBase64(tx),
          included: included.length,
          excluded,
          expiresAt: "epoch:9",
        },
      }
    }
    const batchPath = /^\/api\/security-deletions\/([^/]+)(\/submit)?$/.exec(
      path
    )
    const batch = batchPath && batches.get(batchPath[1]!)
    if (!batch) return error(404, "BATCH_NOT_FOUND", "REFETCH")
    if (batchPath[2]) {
      await verifyTransactionSignature(batch.tx, body.signature, { address })
      batch.state = "completed"
      for (const id of batch.blobs) {
        deletable.delete(id)
        deleted.push(id)
      }
      return {
        body: { state: "completed", deleted: batch.blobs.length, digest: "d" },
      }
    }
    if (method === "DELETE") batch.state = "rolled_back"
    return {
      body: {
        state: batch.state,
        blobCount: batch.blobs.length,
        digest: null,
        resolvedAt: null,
      },
    }
  }

  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace("https://relayer.test", "")
    const headers = init.headers as Record<string, string>
    const reply = await handle(
      path,
      init.method ?? "GET",
      init.body ? JSON.parse(init.body as string) : null,
      headers.authorization ?? null
    )
    return Response.json(reply.body, { status: reply.status ?? 200 })
  })
  const deps: DeletionDeps = {
    relayerUrl: "https://relayer.test",
    fetch,
    sleep: async () => {},
  }
  return { deps, fetch, deleted, batches, deletable }
}

function calls(fetch: ReturnType<typeof fakeRelayer>["fetch"], path: string) {
  return fetch.mock.calls.filter(([url]) => url.includes(path)).length
}

describe("permanent deletion", () => {
  it("offers only this app's memories that the relayer can delete", async () => {
    const relayer = fakeRelayer({ deletable: ["a", "b", "c", "other-app"] })
    const client = deletionClient(wallet, relayer.deps)
    expect(await findDeletable(client, new Set(["a", "b", "c", "x"]))).toEqual({
      blobIds: ["a", "b", "c"],
      batchMax: 900,
    })
    // Signed in once for both pages.
    expect(calls(relayer.fetch, "/challenge")).toBe(1)
  })

  it("deletes in batches the relayer accepts, signing what it prepared", async () => {
    const relayer = fakeRelayer({ deletable: ["a", "b", "c"], batchMax: 2 })
    const client = deletionClient(wallet, relayer.deps)
    const progress = vi.fn()
    const result = await deleteBlobs(client, wallet, ["a", "b", "c"], 2, {
      deps: relayer.deps,
      onProgress: progress,
    })
    expect(result).toEqual({ deleted: 3, excluded: [], unconfirmed: 0 })
    expect(relayer.deleted).toEqual(["a", "b", "c"])
    expect(progress.mock.calls).toEqual([
      [2, 3],
      [3, 3],
    ])
  })

  it("reports what Walrus left out instead of claiming it", async () => {
    const relayer = fakeRelayer({
      deletable: ["a", "b"],
      excluded: { b: "expired" },
    })
    const client = deletionClient(wallet, relayer.deps)
    const result = await deleteBlobs(client, wallet, ["a", "b"], 900, {
      deps: relayer.deps,
    })
    expect(result).toEqual({
      deleted: 1,
      excluded: [{ blobId: "b", reason: "expired" }],
      unconfirmed: 0,
    })
  })

  it("signs in again once when the token has expired", async () => {
    let expireOnce = true
    const relayer = fakeRelayer({
      deletable: ["a"],
      override: (path) => {
        if (path.startsWith("/api/security-deletable-blobs") && expireOnce) {
          expireOnce = false
          return error(401, "AUTH_TOKEN_EXPIRED", "REAUTH")
        }
      },
    })
    const client = deletionClient(wallet, relayer.deps)
    expect((await client.listDeletable()).blobIds).toEqual(["a"])
    expect(calls(relayer.fetch, "/challenge")).toBe(2)
  })

  it("leaves out memories that stopped being deletable since the check", async () => {
    const relayer = fakeRelayer({ deletable: ["a", "b"] })
    const client = deletionClient(wallet, relayer.deps)
    relayer.deletable.delete("b")
    const result = await deleteBlobs(client, wallet, ["a", "b"], 900, {
      deps: relayer.deps,
    })
    expect(result.deleted).toBe(1)
    expect(relayer.deleted).toEqual(["a"])
  })

  it("waits out an uncertain submit instead of preparing it again", async () => {
    let first = true
    const relayer = fakeRelayer({
      deletable: ["a"],
      override: (path) => {
        if (path.endsWith("/submit") && first) {
          first = false
          // The transaction went through, but the response didn't say so.
          for (const batch of relayer.batches.values())
            batch.state = "completed"
          return error(503, "RPC_UNAVAILABLE", "RETRY_AFTER")
        }
      },
    })
    const client = deletionClient(wallet, relayer.deps)
    const result = await deleteBlobs(client, wallet, ["a"], 900, {
      deps: relayer.deps,
    })
    expect(result).toEqual({ deleted: 1, excluded: [], unconfirmed: 0 })
    expect(calls(relayer.fetch, "/api/security-deletions")).toBe(3)
  })

  it("counts a batch Sui hasn't confirmed yet as unconfirmed, not deleted", async () => {
    const relayer = fakeRelayer({
      deletable: ["a"],
      override: (path) => {
        if (path.endsWith("/submit")) {
          for (const batch of relayer.batches.values())
            batch.state = "executing"
          return error(503, "RPC_UNAVAILABLE", "RETRY_AFTER")
        }
      },
    })
    const client = deletionClient(wallet, relayer.deps)
    const result = await deleteBlobs(client, wallet, ["a"], 900, {
      deps: relayer.deps,
    })
    expect(result).toEqual({ deleted: 0, excluded: [], unconfirmed: 1 })
  })

  it("releases a prepared batch if the wallet won't sign it", async () => {
    const relayer = fakeRelayer({ deletable: ["a"] })
    const client = deletionClient(wallet, relayer.deps)
    // The session signs in with the wallet; this one refuses the deletion.
    const refusing = {
      ...wallet,
      signRaw: async () => {
        throw new Error("Rejected")
      },
    }
    await expect(
      deleteBlobs(client, refusing, ["a"], 900, { deps: relayer.deps })
    ).rejects.toThrow("Rejected")
    expect([...relayer.batches.values()][0]?.state).toBe("rolled_back")
    expect(relayer.deleted).toEqual([])
  })
})
