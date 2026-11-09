import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addHypothesis,
  createInvestigation,
  startTesting,
  updateInvestigation,
} from "@/modules/investigation"
import { correctAnswer } from "@/modules/journal/corrections"
import {
  closeDb,
  discoveries,
  hypotheses,
  investigations,
  kv,
  responses,
  type Discovery,
} from "@/modules/memory"
import { activateAccountDb, DB_NAME } from "@/modules/memory/db"

import type { MemoryApi, MemoryWorkspace } from "./api"
import { searchPastResearch } from "./recall"
import { getRecalledNote } from "./recalled"
import { loadResumePoint } from "./resume"
import { memoryPrefix, readCatalog, SYNC_STATE_KEY, type Fact } from "./records"
import {
  listPreferences,
  removePreference,
  savePreference,
} from "./preferences"
import {
  getMemoryOverview,
  getMemoryState,
  getRestoredHandoffs,
  runMemorySync,
} from "./sync"

/** One Walrus Memory account, shared by every device in a test. */
function fakeWalrus(statuses: Record<string, string> = {}) {
  let epoch = 0
  let next = 0
  const rows: { namespace: string; blobId: string; text: string }[] = []
  const api = {
    open: vi.fn(async (): Promise<MemoryWorkspace> => {
      const current = epoch
      return {
        epoch: current,
        catalog: readCatalog(
          rows.map(({ namespace, blobId }) => ({
            namespace_id: namespace,
            blob_id: blobId,
          })),
          current
        ),
        read: async (reference) => {
          const row = rows.find(
            ({ namespace, blobId }) =>
              namespace === reference.namespace && blobId === reference.blobId
          )
          if (!row) throw new Error("missing")
          return row.text
        },
        search: async (_query, limit) =>
          rows
            .filter(
              ({ namespace }) =>
                namespace === `${memoryPrefix(current)}research`
            )
            .slice(0, limit)
            .map(({ blobId, text }) => ({ blobId, text, distance: 0.4 })),
      }
    }),
    remember: vi.fn(async (facts: readonly Fact[], at: number) => ({
      jobIds: facts.map(({ namespace, text }) => {
        const id = next++
        if ((statuses[`job-${id}`] ?? "done") === "done") {
          rows.push({
            namespace: `${memoryPrefix(at)}${namespace}`,
            blobId: `blob-${id}`,
            text,
          })
        }
        return `job-${id}`
      }),
    })),
    status: vi.fn(async (jobIds: string[]) => ({
      jobs: jobIds.map((jobId) => ({
        jobId,
        status: statuses[jobId] ?? "done",
      })),
    })),
    forget: vi.fn(async () => ++epoch),
  } satisfies MemoryApi
  return { api, rows }
}

/** Each device keeps its own browser storage. */
async function onDevice(name: "laptop" | "phone") {
  await closeDb()
  await activateAccountDb(name)
}

/** Runs passes until there's nothing left to send. */
async function settle(api: MemoryApi) {
  for (let pass = 0; pass < 10; pass++) {
    if (!(await runMemorySync(api, "u1")).more) return
  }
  throw new Error("Sync never settled")
}

const METRIC = { assessmentId: "go-no-go", metricId: "medianRt" }

async function startInvestigation() {
  const investigation = await createInvestigation({
    title: "Sleep and speed",
    question: "Does sleep affect my reaction time?",
    origin: "user",
    objectives: ["Pair sleep with a reaction game"],
    evidenceRequirements: [
      { factorId: "sleep.hours", metric: METRIC, minPairs: 8 },
    ],
  })
  const hypothesis = await addHypothesis({
    investigationId: investigation.id,
    statement: "More sleep comes with faster reactions",
    factorId: "sleep.hours",
    metric: METRIC,
    expectedDirection: "negative",
    rationale: "Early sessions hinted at it",
  })
  return { investigation, hypothesis }
}

function finding(overrides: Partial<Discovery> = {}): Discovery {
  return {
    id: "d1",
    investigationId: "i1",
    hypothesisId: "h1",
    analysisIds: ["a1"],
    grade: "moderate",
    verdict: "supported",
    observed: "You react faster after more sleep.",
    evidence: "12 comparable sessions.",
    reliability: "Moderate evidence.",
    uncertainty: "Stress could also play a part.",
    nextStep: "Check stress.",
    createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
  await deleteDB(`${DB_NAME}:phone`)
  await onDevice("laptop")
})

describe("runMemorySync", () => {
  it("sends new records once and marks them saved after storage", async () => {
    const { api } = fakeWalrus()
    await discoveries.put(finding({ id: "d1" }))
    await discoveries.put(finding({ id: "d2" }))
    expect(await runMemorySync(api, "u1")).toEqual({ more: true })
    expect(api.remember.mock.calls[0]?.[0].map(({ id }) => id)).toEqual([
      "finding:d1",
      "finding:d2",
    ])

    expect(await runMemorySync(api, "u1")).toEqual({ more: false })
    expect((await getMemoryState()).remembered.sort()).toEqual([
      "finding:d1",
      "finding:d2",
    ])
    await runMemorySync(api, "u1")
    expect(api.remember).toHaveBeenCalledOnce()
  })

  it("waits on running jobs without resending them", async () => {
    const { api } = fakeWalrus({ "job-0": "running" })
    await discoveries.put(finding())
    await runMemorySync(api, "u1")
    expect(await runMemorySync(api, "u1")).toEqual({ more: true })
    expect(api.remember).toHaveBeenCalledOnce()
  })

  it("sends a record again if its job failed", async () => {
    const { api } = fakeWalrus({ "job-0": "failed" })
    await discoveries.put(finding())
    await runMemorySync(api, "u1")
    await runMemorySync(api, "u1")
    expect(api.remember).toHaveBeenCalledTimes(2)
  })

  it("keeps its place when the service is down, then carries on", async () => {
    const { api } = fakeWalrus()
    await discoveries.put(finding())
    api.remember.mockRejectedValueOnce(new Error("down"))
    await expect(runMemorySync(api, "u1")).rejects.toThrow("down")
    await settle(api)
    expect((await getMemoryState()).remembered).toEqual(["finding:d1"])
  })

  it("sends a long backlog in batches the proxy accepts", async () => {
    const { api } = fakeWalrus()
    for (let i = 0; i < 13; i++) await discoveries.put(finding({ id: `d${i}` }))
    await settle(api)
    const sizes = api.remember.mock.calls.map(([facts]) => facts.length)
    expect(sizes).toEqual([10, 3])
    for (const [facts] of api.remember.mock.calls) {
      const chars = facts.reduce((sum, { text }) => sum + text.length, 0)
      expect(chars).toBeLessThanOrEqual(40_000)
    }
  })

  it("doesn't save one person's local records into another's account", async () => {
    const { api } = fakeWalrus()
    await discoveries.put(finding({ id: "d1" }))
    await settle(api)
    await discoveries.put(finding({ id: "d2" }))
    await runMemorySync(api, "u2")
    expect(api.remember).toHaveBeenCalledOnce()
    expect((await getMemoryState()).owner).toBe("u2")
  })

  it("doesn't re-upload forgotten records after another device forgets", async () => {
    const { api } = fakeWalrus()
    await discoveries.put(finding({ id: "d1" }))
    await settle(api)
    await api.forget()
    await settle(api)
    expect(api.remember).toHaveBeenCalledOnce()
    await discoveries.put(finding({ id: "d2" }))
    await settle(api)
    expect(api.remember.mock.lastCall?.[0].map(({ id }) => id)).toEqual([
      "finding:d2",
    ])
    expect(api.remember.mock.lastCall?.[1]).toBe(1)
  })

  it("sets up the account even with nothing to save yet", async () => {
    const { api } = fakeWalrus()
    await runMemorySync(api, "u1")
    expect(api.open).toHaveBeenCalledOnce()
    expect(api.remember).not.toHaveBeenCalled()
  })

  it("stops reporting a failure once it gets through", async () => {
    await kv.set(SYNC_STATE_KEY, { failing: true })
    await runMemorySync(fakeWalrus().api, "u1")
    expect((await getMemoryState()).failing).toBe(false)
  })
})

describe("resuming on another device", () => {
  it("picks up an investigation on a fresh phone without repeating setup", async () => {
    const { api } = fakeWalrus()
    const { investigation, hypothesis } = await startInvestigation()
    await discoveries.put(
      finding({
        investigationId: investigation.id,
        hypothesisId: hypothesis.id,
      })
    )
    const nextMeasurementAt = Date.now() + 3 * 24 * 60 * 60 * 1000
    await updateInvestigation(investigation.id, {
      nextStep: "One more reaction game after a short night.",
      nextMeasurementAt,
    })
    await settle(api)

    await onDevice("phone")
    expect(await investigations.list()).toEqual([])
    await settle(api)

    const [restored] = await investigations.list()
    expect(restored).toMatchObject({
      id: investigation.id,
      question: "Does sleep affect my reaction time?",
      nextStep: "One more reaction game after a short night.",
      nextMeasurementAt,
    })
    expect((await hypotheses.list()).map(({ id }) => id)).toEqual([
      hypothesis.id,
    ])
    expect(await loadResumePoint()).toMatchObject({
      question: "Does sleep affect my reaction time?",
      lastResult: {
        observed: "You react faster after more sleep.",
        grade: "moderate",
      },
    })
    // Planning the same question again finds the restored one.
    expect(
      (
        await createInvestigation({
          title: "Sleep and speed",
          question: "Does sleep affect my reaction time?",
          origin: "user",
          objectives: [],
          evidenceRequirements: [],
        })
      ).id
    ).toBe(investigation.id)
    // Taking it on isn't news, so the phone sends nothing back.
    const sent = api.remember.mock.calls.length
    await settle(api)
    expect(api.remember.mock.calls.length).toBe(sent)
  })

  it("carries what the phone learns back to the laptop", async () => {
    const { api } = fakeWalrus()
    const { investigation } = await startInvestigation()
    await settle(api)

    await onDevice("phone")
    await settle(api)
    await updateInvestigation(investigation.id, {
      progressNote: "Two more short nights would settle it.",
    })
    await settle(api)

    await onDevice("laptop")
    await settle(api)
    expect((await investigations.get(investigation.id))?.progressNote).toBe(
      "Two more short nights would settle it."
    )
    expect(Object.keys(await getRestoredHandoffs())).toEqual([investigation.id])
  })

  it("keeps the last verified result when the phone moves the plan on", async () => {
    const { api } = fakeWalrus()
    const { investigation, hypothesis } = await startInvestigation()
    await discoveries.put(
      finding({
        investigationId: investigation.id,
        hypothesisId: hypothesis.id,
      })
    )
    await settle(api)

    await onDevice("phone")
    await settle(api)
    await updateInvestigation(investigation.id, {
      progressNote: "Next: stress.",
    })
    await settle(api)

    await closeDb()
    await deleteDB(`${DB_NAME}:phone`)
    await onDevice("phone")
    await settle(api)
    expect(await loadResumePoint()).toMatchObject({
      lastResult: { observed: "You react faster after more sleep." },
    })
  })

  it("syncs the phone's changes even when its clock is behind", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    try {
      const { api } = fakeWalrus()
      vi.setSystemTime(10_000_000)
      const { investigation, hypothesis } = await startInvestigation()
      await settle(api)

      await onDevice("phone")
      vi.setSystemTime(5_000_000)
      await settle(api)
      await updateInvestigation(investigation.id, {
        progressNote: "From a slow clock.",
      })
      await startTesting(hypothesis.id, "Collecting pairs")
      await settle(api)

      await onDevice("laptop")
      vi.setSystemTime(10_000_100)
      await settle(api)
      expect((await investigations.get(investigation.id))?.progressNote).toBe(
        "From a slow clock."
      )
      expect((await hypotheses.get(hypothesis.id))?.status).toBe("testing")
    } finally {
      vi.useRealTimers()
    }
  })

  it("leaves completed investigations it never saw out of the way", async () => {
    const { api } = fakeWalrus()
    const { investigation } = await startInvestigation()
    await updateInvestigation(investigation.id, { status: "completed" })
    await settle(api)

    await onDevice("phone")
    await settle(api)
    expect(await investigations.list()).toEqual([])
  })

  it("ignores a handoff that isn't the record its name says", async () => {
    const { api, rows } = fakeWalrus()
    const { investigation } = await startInvestigation()
    await settle(api)
    const handoff = rows.find(({ namespace }) =>
      namespace.includes(":handoff:")
    )!
    handoff.text = handoff.text.replace(investigation.id, "someone-else")

    await onDevice("phone")
    await settle(api)
    expect(await investigations.list()).toEqual([])
  })
})

describe("correcting an answer", () => {
  /** A finding on the laptop, already resumed on the phone. */
  async function sharedFinding(api: MemoryApi) {
    const { investigation, hypothesis } = await startInvestigation()
    await responses.put({
      id: "r1",
      sessionId: "s1",
      questionId: "sleep.hours",
      bankVersion: 1,
      value: 7,
      answeredAt: 1,
    })
    await discoveries.put(
      finding({
        investigationId: investigation.id,
        hypothesisId: hypothesis.id,
      })
    )
    await settle(api)
    await onDevice("phone")
    await settle(api)
    expect((await loadResumePoint())?.lastResult).toBeDefined()
    expect(await searchPastResearch("sleep", 6, api)).toHaveLength(1)
    await onDevice("laptop")
  }

  it("stops the old conclusion appearing on both devices", async () => {
    const { api } = fakeWalrus()
    await sharedFinding(api)
    const [onLaptop] = await searchPastResearch("sleep", 6, api)
    expect(await getRecalledNote(onLaptop!.reference)).toMatchObject({
      findingId: "d1",
      grade: "moderate",
    })
    await onDevice("phone")
    const [onPhone] = await searchPastResearch("sleep", 6, api)
    await onDevice("laptop")

    await correctAnswer("r1", 6)
    // Honored here before Walrus has heard.
    expect(await searchPastResearch("sleep", 6, api)).toEqual([])
    expect((await loadResumePoint())?.lastResult).toBeUndefined()
    expect(await getRecalledNote(onLaptop!.reference)).toBeNull()
    await settle(api)

    await onDevice("phone")
    const changed = vi.fn()
    await runMemorySync(api, "u1", { onChanged: changed })
    expect(changed).toHaveBeenCalled()
    expect((await loadResumePoint())?.lastResult).toBeUndefined()
    expect(await getRecalledNote(onPhone!.reference)).toBeNull()
    expect(await searchPastResearch("sleep", 6, api)).toEqual([])
    expect((await investigations.list())[0]?.progressNote).toMatch(/corrected/i)
  })

  it("won't take the conclusion back from a device that hadn't heard", async () => {
    const { api } = fakeWalrus()
    await sharedFinding(api)

    // The phone moves the plan on, still carrying the old result.
    await onDevice("phone")
    const [resumed] = await investigations.list()
    await onDevice("laptop")
    await correctAnswer("r1", 6)
    await onDevice("phone")
    await updateInvestigation(resumed!.id, { progressNote: "Later work." })
    await settle(api)

    await onDevice("laptop")
    await settle(api)
    expect((await loadResumePoint())?.lastResult).toBeUndefined()
    expect(
      (await getRestoredHandoffs())[resumed!.id]?.latestFinding
    ).toBeUndefined()
  })

  it("drops a withdrawn finding that came back with an old backup", async () => {
    const { api } = fakeWalrus()
    await sharedFinding(api)
    const [old] = await discoveries.list()
    await correctAnswer("r1", 6)
    await settle(api)

    await onDevice("phone")
    await discoveries.put(old!)
    await settle(api)
    expect(await discoveries.list()).toEqual([])
  })
})

describe("remembered preferences", () => {
  it("follows the person to every device, edits and removals included", async () => {
    const { api } = fakeWalrus()
    const { id } = await savePreference("  Mornings work best for check-ins ")
    await settle(api)

    await onDevice("phone")
    await settle(api)
    expect(await listPreferences()).toMatchObject([
      { id, text: "Mornings work best for check-ins" },
    ])
    await savePreference("Evenings work best for check-ins", id)
    await settle(api)

    await onDevice("laptop")
    await settle(api)
    expect((await listPreferences()).map(({ text }) => text)).toEqual([
      "Evenings work best for check-ins",
    ])
    await removePreference(id)
    await settle(api)

    await onDevice("phone")
    await settle(api)
    expect(await listPreferences()).toEqual([])
  })

  it("lets the newest edit win, wherever it was made", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    try {
      const { api } = fakeWalrus()
      vi.setSystemTime(1_000)
      const { id } = await savePreference("Mornings")
      await settle(api)
      await onDevice("phone")
      await settle(api)

      // The phone's edit syncs first, but the laptop's is newer.
      vi.setSystemTime(2_000)
      await savePreference("Evenings", id)
      await onDevice("laptop")
      vi.setSystemTime(3_000)
      await savePreference("Afternoons", id)
      await onDevice("phone")
      await settle(api)
      await onDevice("laptop")
      await settle(api)
      expect((await listPreferences())[0]?.text).toBe("Afternoons")

      await onDevice("phone")
      await settle(api)
      expect((await listPreferences())[0]?.text).toBe("Afternoons")
    } finally {
      vi.useRealTimers()
    }
  })

  it("is kept apart from research", async () => {
    const { api } = fakeWalrus()
    await savePreference("Mornings work best for check-ins")
    await discoveries.put(finding())
    await settle(api)
    expect(
      (await searchPastResearch("mornings", 6, api)).map(
        ({ observed }) => observed
      )
    ).toEqual(["You react faster after more sleep."])
  })

  it("shows what has synced and what hasn't yet", async () => {
    const { api } = fakeWalrus()
    const { investigation } = await startInvestigation()
    await savePreference("Mornings")
    expect(await getMemoryOverview(api)).toMatchObject({
      investigations: [{ id: investigation.id, synced: false }],
      preferences: [{ text: "Mornings", synced: false }],
    })
    await settle(api)
    expect(await getMemoryOverview(api)).toMatchObject({
      investigations: [{ synced: true }],
      preferences: [{ synced: true }],
      findings: 0,
    })
  })

  it("is forgotten with everything else", async () => {
    const { api } = fakeWalrus()
    await savePreference("Mornings")
    await settle(api)
    await onDevice("phone")
    await settle(api)
    await api.forget()
    await settle(api)
    expect(await listPreferences()).toEqual([])
  })
})
