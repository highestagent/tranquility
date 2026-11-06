import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it } from "vitest"

import { analyses, closeDb, hypotheses, type Analysis } from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import {
  addHypothesis,
  createInvestigation,
  evaluateHypothesis,
  rejectHypothesis,
  startTesting,
} from "./service"
import { getInvestigationState } from "./state"
import { decideVerdict } from "./verdict"

const METRIC = { assessmentId: "go-no-go", metricId: "medianRt" }

function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: "a1",
    createdAt: 1,
    factorId: "sleep.hours",
    metric: METRIC,
    method: "spearman",
    n: 24,
    effect: -0.6,
    ciLow: -0.8,
    ciHigh: -0.3,
    pValue: 0.001,
    direction: "negative",
    grade: "strong",
    measurementIds: [],
    notes: ["Adjusted."],
    ...overrides,
  }
}

async function setup() {
  const investigation = await createInvestigation({
    title: "Sleep and speed",
    question: "Does sleep affect my reaction time?",
    origin: "user",
    objectives: ["Collect paired data"],
    evidenceRequirements: [
      { factorId: "sleep.hours", metric: METRIC, minPairs: 8 },
    ],
  })
  const hypothesis = await addHypothesis({
    investigationId: investigation.id,
    statement: "More sleep means faster reactions",
    factorId: "sleep.hours",
    metric: METRIC,
    expectedDirection: "negative",
    rationale: "A pattern appeared in early sessions",
  })
  return { investigation, hypothesis }
}

const narrative = {
  observed: "You react faster after more sleep.",
  uncertainty: "Other daily factors could also play a part.",
  nextStep: "Check whether caffeine changes this.",
}

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("decideVerdict", () => {
  it("supports only with moderate or strong matching evidence", () => {
    const base = { n: 24, ciLow: -0.8, ciHigh: -0.3 }
    expect(
      decideVerdict("negative", {
        ...base,
        grade: "strong",
        direction: "negative",
      })
    ).toBe("supported")
    expect(
      decideVerdict("any", {
        ...base,
        grade: "moderate",
        direction: "positive",
      })
    ).toBe("supported")
    expect(
      decideVerdict("negative", {
        ...base,
        grade: "weak",
        direction: "negative",
      })
    ).toBe("inconclusive")
  })

  it("refutes on strong evidence in the opposite direction", () => {
    expect(
      decideVerdict("negative", {
        n: 24,
        ciLow: 0.3,
        ciHigh: 0.8,
        grade: "strong",
        direction: "positive",
      })
    ).toBe("refuted")
  })

  it("refutes when plenty of data rules out a meaningful effect", () => {
    const ruledOut = {
      grade: "weak",
      direction: "none",
      ciLow: -0.2,
      ciHigh: 0.2,
    } as const
    expect(decideVerdict("negative", { ...ruledOut, n: 30 })).toBe("refuted")
    expect(decideVerdict("negative", { ...ruledOut, n: 10 })).toBe(
      "inconclusive"
    )
  })

  it("stays inconclusive on insufficient or contradictory evidence", () => {
    const base = {
      n: 24,
      ciLow: null,
      ciHigh: null,
      direction: "none",
    } as const
    expect(decideVerdict("any", { ...base, grade: "insufficient" })).toBe(
      "inconclusive"
    )
    expect(decideVerdict("any", { ...base, grade: "contradictory" })).toBe(
      "inconclusive"
    )
  })
})

describe("evaluateHypothesis", () => {
  it("takes the verdict and evidence from the stored analysis", async () => {
    const { hypothesis } = await setup()
    await analyses.put(analysis())

    const discovery = await evaluateHypothesis({
      hypothesisId: hypothesis.id,
      analysisIds: ["a1"],
      ...narrative,
    })

    expect(discovery.verdict).toBe("supported")
    expect(discovery.grade).toBe("strong")
    expect(discovery.evidence).toContain("24 comparable sessions")
    expect(discovery.evidence).toContain("-0.60")
    expect(discovery.evidence).toContain("p = 0.001")

    await analyses.put(analysis({ id: "a2", createdAt: 2, pValue: 0.0005 }))
    const tiny = await evaluateHypothesis({
      hypothesisId: hypothesis.id,
      analysisIds: ["a2"],
      ...narrative,
    })
    expect(tiny.evidence).toContain("p < 0.001")
    expect((await hypotheses.get(hypothesis.id))?.status).toBe("supported")
  })

  it("refuses an analysis that doesn't exist", async () => {
    const { hypothesis } = await setup()
    await expect(
      evaluateHypothesis({
        hypothesisId: hypothesis.id,
        analysisIds: ["made-up"],
        ...narrative,
      })
    ).rejects.toThrow(/Unknown analysis/)
  })

  it("refuses an analysis of a different relationship", async () => {
    const { hypothesis } = await setup()
    await analyses.put(analysis({ factorId: "mood.energy" }))
    await expect(
      evaluateHypothesis({
        hypothesisId: hypothesis.id,
        analysisIds: ["a1"],
        ...narrative,
      })
    ).rejects.toThrow(/don't|None of these/)
    expect((await hypotheses.get(hypothesis.id))?.status).toBe("proposed")
  })

  it("uses the newest analysis when several are cited", async () => {
    const { hypothesis } = await setup()
    await analyses.put(analysis({ id: "old", createdAt: 1 }))
    await analyses.put(
      analysis({
        id: "new",
        createdAt: 2,
        grade: "insufficient",
        direction: "none",
        effect: null,
        ciLow: null,
        ciHigh: null,
      })
    )
    const discovery = await evaluateHypothesis({
      hypothesisId: hypothesis.id,
      analysisIds: ["old", "new"],
      ...narrative,
    })
    expect(discovery.verdict).toBe("inconclusive")
  })
})

describe("hypothesis lifecycle", () => {
  it("records history and blocks changes after rejection", async () => {
    const { hypothesis } = await setup()
    await startTesting(hypothesis.id, "Collecting data")
    await rejectHypothesis(hypothesis.id, "No longer relevant")

    const stored = await hypotheses.get(hypothesis.id)
    expect(stored?.history.map((entry) => entry.status)).toEqual([
      "proposed",
      "testing",
      "rejected",
    ])
    await expect(startTesting(hypothesis.id, "Again")).rejects.toThrow()
  })
})

describe("getInvestigationState", () => {
  it("summarizes open work and progress for resuming", async () => {
    const { investigation, hypothesis } = await setup()
    const state = await getInvestigationState()
    expect(state.open).toHaveLength(1)
    expect(state.open[0]?.id).toBe(investigation.id)
    expect(state.open[0]?.hypotheses[0]?.id).toBe(hypothesis.id)
    expect(state.open[0]?.evidence[0]).toMatchObject({ have: 0, need: 8 })
  })
})
