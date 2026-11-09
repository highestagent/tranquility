import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryApi, setMemoryAccount } from "./api"

const recall = vi.fn()
const listMemories = vi.fn()

vi.mock("@mysten-incubation/memwal", () => ({
  MemWal: { create: () => ({ recall, listMemories }) },
}))
vi.mock("./provision", () => ({
  connectMemoryAccount: async () => ({ accountId: "0xa", key: "k" }),
}))
vi.mock("./wallet", () => ({ toSuiWallet: () => ({}) }))

function signIn() {
  setMemoryAccount({
    userId: "u1",
    getToken: async () => "token",
    getWallet: async () => ({
      address: "0x1",
      signRawHash: async () => "0x00",
    }),
  })
}

function row(namespace: string, blobId: string) {
  return { namespace_id: namespace, blob_id: blobId }
}

const HANDOFF = `tranquility-3:handoff:${"a".repeat(64)}:5:active`

beforeEach(() => {
  recall.mockReset()
  listMemories.mockReset()
  listMemories.mockResolvedValue({
    memories: [],
    has_more: false,
    next_cursor: null,
  })
  vi.stubGlobal("window", { location: { origin: "http://app.test" } })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ epoch: 3 }))
  )
  signIn()
})

afterEach(() => {
  setMemoryAccount(null)
  vi.unstubAllGlobals()
})

describe("memoryApi.open", () => {
  it("walks the whole inventory before deciding what's current", async () => {
    listMemories
      .mockResolvedValueOnce({
        memories: [row(HANDOFF, "b1")],
        has_more: true,
        next_cursor: "c1",
      })
      .mockResolvedValueOnce({
        memories: [
          row("tranquility-3:research", "b2"),
          row("tranquility-2:research", "old"),
        ],
        has_more: false,
        next_cursor: "c2",
      })
    const { epoch, catalog } = await memoryApi.open()
    expect(epoch).toBe(3)
    expect(listMemories.mock.calls[1]?.[0]).toMatchObject({ cursor: "c1" })
    expect(catalog.findings).toBe(1)
    expect(catalog.handoffs.get("a".repeat(64))).toMatchObject({
      blobId: "b1",
      revision: 5,
      status: "active",
    })
  })

  it("reads the exact revision even when a retry stored two copies", async () => {
    recall.mockResolvedValue({
      results: [
        { blob_id: "copy", text: "other", distance: 0.1 },
        { blob_id: "b1", text: "wanted", distance: 0.9 },
      ],
    })
    const workspace = await memoryApi.open()
    await expect(
      workspace.read({ namespace: HANDOFF, blobId: "b1", revision: 5 })
    ).resolves.toBe("wanted")
    expect(recall.mock.calls[0]?.[0]).toMatchObject({ namespace: HANDOFF })
    await expect(
      workspace.read({ namespace: HANDOFF, blobId: "gone", revision: 5 })
    ).rejects.toThrow()
  })

  it("searches findings with no minimum score, so a broad question still finds them", async () => {
    recall.mockResolvedValue({
      results: [{ blob_id: "b2", text: "Sleep note", distance: 0.81 }],
    })
    const workspace = await memoryApi.open()
    expect(await workspace.search("What do you remember about me?", 6)).toEqual(
      [{ blobId: "b2", text: "Sleep note", distance: 0.81 }]
    )
    expect(recall.mock.calls[0]?.[0]).toEqual({
      query: "What do you remember about me?",
      namespace: "tranquility-3:research",
      limit: 6,
    })
  })

  it("picks up a forget from another device on the next open", async () => {
    expect((await memoryApi.open()).epoch).toBe(3)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ epoch: 4 }))
    )
    expect((await memoryApi.open()).epoch).toBe(4)
  })

  it("stops if the inventory doesn't advance", async () => {
    listMemories.mockResolvedValue({
      memories: [],
      has_more: true,
      next_cursor: "same",
    })
    await expect(memoryApi.open()).rejects.toThrow()
  })
})
