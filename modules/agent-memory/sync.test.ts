import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { setAiConsent } from "@/modules/agent/consent"
import { closeDb, kv } from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import { NotSignedInError, type MemoryApi } from "./api"
import {
  getMemoryState,
  getSavedCount,
  runMemorySync,
  setMemoryEnabled,
} from "./sync"

function fakeApi(statuses: Record<string, string> = {}) {
  let next = 0
  return {
    remember: vi.fn(async (texts: string[]) => ({
      jobIds: texts.map(() => `job-${next++}`),
    })),
    status: vi.fn(async (jobIds: string[]) => ({
      jobs: jobIds.map((jobId) => ({
        jobId,
        status: statuses[jobId] ?? "done",
      })),
    })),
    recall: vi.fn(),
    forget: vi.fn(),
    connect: vi.fn(async () => undefined),
    count: vi.fn(async () => 0),
  } satisfies MemoryApi
}

const facts = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `fact-${index}`,
    text: `Fact ${index}`,
  }))

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("runMemorySync", () => {
  it("sends new facts, then marks them saved once stored", async () => {
    const api = fakeApi()
    expect(await runMemorySync(api, "u1", facts(2))).toEqual({ more: true })
    expect(api.remember).toHaveBeenCalledWith(["Fact 0", "Fact 1"])

    expect(await runMemorySync(api, "u1", facts(2))).toEqual({ more: false })
    const state = await getMemoryState()
    expect(state.remembered).toEqual(["fact-0", "fact-1"])
    expect(state.pending).toEqual([])
  })

  it("never sends a fact twice", async () => {
    const api = fakeApi()
    await runMemorySync(api, "u1", facts(1))
    await runMemorySync(api, "u1", facts(1))
    await runMemorySync(api, "u1", facts(1))
    expect(api.remember).toHaveBeenCalledTimes(1)
  })

  it("waits on running jobs without resending them", async () => {
    const api = fakeApi({ "job-0": "running" })
    await runMemorySync(api, "u1", facts(1))
    expect(await runMemorySync(api, "u1", facts(1))).toEqual({ more: true })
    expect(api.remember).toHaveBeenCalledTimes(1)
  })

  it("sends a fact again if its job failed", async () => {
    const api = fakeApi({ "job-0": "failed" })
    await runMemorySync(api, "u1", facts(1))
    await runMemorySync(api, "u1", facts(1))
    expect(api.remember).toHaveBeenCalledTimes(2)
    expect((await getMemoryState()).remembered).toEqual([])
  })

  it("keeps its place when the service is down, then carries on", async () => {
    const api = fakeApi()
    api.remember.mockRejectedValueOnce(new Error("down"))
    await expect(runMemorySync(api, "u1", facts(1))).rejects.toThrow("down")

    await runMemorySync(api, "u1", facts(1))
    await runMemorySync(api, "u1", facts(1))
    expect((await getMemoryState()).remembered).toEqual(["fact-0"])
  })

  it("sends a long backlog in batches", async () => {
    const api = fakeApi()
    expect(await runMemorySync(api, "u1", facts(13))).toEqual({ more: true })
    expect(api.remember.mock.calls[0]?.[0]).toHaveLength(10)
    await runMemorySync(api, "u1", facts(13))
    expect(api.remember.mock.calls[1]?.[0]).toHaveLength(3)
  })

  it("doesn't save one person's local facts into another's account", async () => {
    const api = fakeApi()
    await runMemorySync(api, "u1", facts(1))
    await runMemorySync(api, "u2", facts(3))
    expect(api.remember).toHaveBeenCalledTimes(1)
    expect((await getMemoryState()).owner).toBe("u2")
  })

  it("saves what someone did before signing in the first time", async () => {
    const api = fakeApi()
    await runMemorySync(api, "u1", facts(2))
    expect(api.remember).toHaveBeenCalledTimes(1)
  })

  it("does nothing while turned off", async () => {
    const api = fakeApi()
    await setMemoryEnabled(false)
    expect(await runMemorySync(api, "u1", facts(2))).toEqual({ more: false })
    expect(api.remember).not.toHaveBeenCalled()
    expect(api.connect).not.toHaveBeenCalled()
  })

  it("sets up the account even with nothing to save yet", async () => {
    const api = fakeApi()
    await runMemorySync(api, "u1", [])
    expect(api.connect).toHaveBeenCalledOnce()
    expect(api.remember).not.toHaveBeenCalled()
  })

  it("stops reporting a failure once it gets through", async () => {
    await kv.set("agentMemory:mainnet", { failing: true })
    await runMemorySync(fakeApi(), "u1", facts(1))
    expect((await getMemoryState()).failing).toBe(false)
  })
})

describe("getSavedCount", () => {
  it("doesn't connect without consent, since that can create an account", async () => {
    await expect(getSavedCount()).resolves.toBeNull()
    await setAiConsent(false)
    await expect(getSavedCount()).resolves.toBeNull()
  })

  it("doesn't connect while memory is off", async () => {
    await setAiConsent(true)
    await setMemoryEnabled(false)
    await expect(getSavedCount()).resolves.toBeNull()
  })

  it("asks the account otherwise", async () => {
    await setAiConsent(true)
    // No one is signed in here, so reaching the account is the part that fails.
    await expect(getSavedCount()).rejects.toBeInstanceOf(NotSignedInError)
  })
})
