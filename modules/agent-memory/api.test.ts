import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryApi, setMemoryAccount } from "./api"

const recall = vi.fn()

vi.mock("@mysten-incubation/memwal", () => ({
  MemWal: { create: () => ({ recall }) },
}))
vi.mock("./provision", () => ({
  connectMemoryAccount: async () => ({ accountId: "0xa", key: "k" }),
}))
vi.mock("./wallet", () => ({ toSuiWallet: () => ({}) }))

beforeEach(() => {
  recall.mockReset()
  vi.stubGlobal("window", { location: { origin: "http://app.test" } })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ epoch: 3 }))
  )
  setMemoryAccount({
    userId: "u1",
    getToken: async () => "token",
    getWallet: async () => ({
      address: "0x1",
      signRawHash: async () => "0x00",
    }),
  })
})

afterEach(() => {
  setMemoryAccount(null)
  vi.unstubAllGlobals()
})

describe("memoryApi.recall", () => {
  it("sets no minimum score, so a broad question still finds notes", async () => {
    recall.mockResolvedValue({
      results: [{ text: "Sleep note", distance: 0.81 }],
    })
    const { memories } = await memoryApi.recall(
      "What do you remember about me?",
      6,
      1000
    )
    expect(memories).toEqual([{ text: "Sleep note", at: null }])
    expect(recall.mock.calls[0]![1]).toEqual({
      limit: 6,
      namespace: "tranquility-3",
    })
  })

  it("gives up at the budget instead of holding up the agent", async () => {
    recall.mockReturnValue(new Promise(() => undefined))
    await expect(memoryApi.recall("anything", 6, 10)).rejects.toThrow(
      "Timed out"
    )
  })
})
