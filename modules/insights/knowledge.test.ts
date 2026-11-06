import { describe, expect, it } from "vitest"

import type { Analysis, Hypothesis } from "@/modules/memory"

import { buildKnowledge } from "./knowledge"

const METRIC = { assessmentId: "go-no-go", metricId: "medianRt" }

function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: "a",
    createdAt: 1,
    factorId: "sleep.hours",
    metric: METRIC,
    method: "spearman",
    n: 24,
    effect: -0.8,
    ciLow: -0.9,
    ciHigh: -0.5,
    pValue: 0.001,
    direction: "negative",
    grade: "strong",
    measurementIds: [],
    notes: [],
    ...overrides,
  }
}

function hypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: "h",
    investigationId: "i",
    statement: "s",
    factorId: "sleep.hours",
    metric: METRIC,
    expectedDirection: "negative",
    status: "testing",
    rationale: "r",
    createdAt: 1,
    updatedAt: 1,
    history: [],
    ...overrides,
  }
}

const build = (input: {
  analyses?: Analysis[]
  hypotheses?: Hypothesis[]
}) =>
  buildKnowledge({
    responses: [],
    measurements: [],
    analyses: input.analyses ?? [],
    hypotheses: input.hypotheses ?? [],
  })

describe("buildKnowledge", () => {
  it("draws no threads without evidence", () => {
    const knowledge = build({})
    expect(knowledge.links).toEqual([])
    expect(knowledge.factors).toHaveLength(5)
    expect(knowledge.abilities).toHaveLength(4)
  })

  it("reads polarity from the metric, since lower reaction time is better", () => {
    const [sleep] = build({ analyses: [analysis()] }).links
    expect(sleep).toMatchObject({ state: "signal", helps: true, domain: "sleep" })

    const [stress] = build({
      analyses: [
        analysis({ factorId: "stress.level", effect: 0.7, direction: "positive" }),
      ],
    }).links
    expect(stress?.helps).toBe(false)
  })

  it("lets a verdict outrank a raw signal", () => {
    const { links } = build({
      analyses: [analysis()],
      hypotheses: [hypothesis({ status: "supported" })],
    })
    expect(links).toHaveLength(1)
    expect(links[0]?.state).toBe("supported")
    expect(links[0]?.effect).toBe(-0.8)
  })

  it("draws a thread while a hypothesis is being tested, with no effect yet", () => {
    const [link] = build({ hypotheses: [hypothesis()] }).links
    expect(link).toMatchObject({ state: "testing", effect: null, helps: null })
  })

  it("ignores rejected hypotheses and uninformative analyses", () => {
    const { links } = build({
      hypotheses: [hypothesis({ status: "rejected" })],
      analyses: [
        analysis({ grade: "insufficient", effect: null, direction: "none" }),
      ],
    })
    expect(links).toEqual([])
  })

  it("uses only the latest analysis of a relationship", () => {
    const { links } = build({
      analyses: [
        analysis({ id: "old", createdAt: 1 }),
        analysis({ id: "new", createdAt: 2, grade: "weak", direction: "none" }),
      ],
    })
    expect(links).toEqual([])
  })

  it("groups questions into domains, keeping the most settled thread", () => {
    const { links } = build({
      hypotheses: [
        hypothesis({ id: "a", factorId: "sleep.hours" }),
        hypothesis({ id: "b", factorId: "sleep.quality", status: "supported" }),
      ],
    })
    expect(links).toHaveLength(1)
    expect(links[0]?.state).toBe("supported")
  })

  it("fills nodes by usable data, counting a session once per domain", () => {
    const answer = (sessionId: string, questionId: string, value: number | null) => ({
      id: `${sessionId}-${questionId}`,
      sessionId,
      questionId,
      bankVersion: 1,
      value,
      answeredAt: 1,
    })
    const { factors } = buildKnowledge({
      responses: [
        answer("s1", "sleep.hours", 7),
        answer("s1", "sleep.quality", 3),
        answer("s2", "sleep.hours", null),
        answer("s3", "sleep.hours", 8),
      ],
      measurements: [],
      analyses: [],
      hypotheses: [],
    })
    expect(factors.find(({ id }) => id === "sleep")).toMatchObject({
      count: 2,
      filled: 0.25,
    })
  })
})
