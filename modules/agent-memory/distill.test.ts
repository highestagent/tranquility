import { describe, expect, it } from "vitest"

import type { Discovery, Hypothesis, Investigation } from "@/modules/memory"

import { distillFacts, MAX_FACT_CHARS, type LocalResearch } from "./distill"
import { findingRecord, handoffRecord, readRecord } from "./records"

const finding: Discovery = {
  id: "d1",
  investigationId: "i1",
  hypothesisId: "h1",
  analysisIds: ["a1"],
  grade: "strong",
  verdict: "supported",
  observed: "You react faster after more sleep.",
  evidence: "24 comparable sessions: correlation of -0.89.",
  reliability: "Strong evidence, within your own data.",
  uncertainty: "Stress could also play a part.",
  nextStep: "Check stress.",
  createdAt: Date.UTC(2026, 10, 6),
}

const hypothesis: Hypothesis = {
  id: "h1",
  investigationId: "i1",
  statement: "More sleep comes with faster reactions",
  factorId: "sleep.hours",
  metric: { assessmentId: "go-no-go", metricId: "medianRt" },
  expectedDirection: "negative",
  status: "supported",
  rationale: "r",
  createdAt: 1,
  updatedAt: 1,
  history: [
    { at: 1, status: "proposed", note: "r" },
    { at: 2, status: "supported", note: "Evaluated" },
  ],
}

const investigation: Investigation = {
  id: "i1",
  title: "Sleep and speed",
  question: "Does sleep matter?",
  origin: "agent",
  status: "active",
  objectives: [],
  evidenceRequirements: [],
  progressNote: "Stress is next.",
  nextStep: "One more game this week.",
  createdAt: 1,
  updatedAt: Date.UTC(2026, 10, 5),
}

const all: LocalResearch = {
  discoveries: [finding],
  hypotheses: [hypothesis],
  investigations: [investigation],
  evidence: {
    i1: [
      { factorId: "sleep.hours", metric: hypothesis.metric, have: 6, need: 8 },
    ],
  },
  restored: {},
}

function handoffOf(input: LocalResearch) {
  const fact = distillFacts(input).find(({ id }) => id.startsWith("handoff:"))
  return fact && { fact, record: readRecord(handoffRecord, fact.text) }
}

describe("distillFacts", () => {
  it("saves a finding's conclusions, searchable with the others", () => {
    const fact = distillFacts(all).find(({ id }) => id === "finding:d1")!
    expect(fact.namespace).toBe("research")
    expect(readRecord(findingRecord, fact.text)).toMatchObject({
      statement: "More sleep comes with faster reactions",
      verdict: "supported",
      grade: "strong",
      uncertainty: "Stress could also play a part.",
    })
    expect(fact.text).not.toContain("a1")
  })

  it("hands off the plan, the last result, and what's missing", () => {
    const { fact, record } = handoffOf(all)!
    expect(fact.namespace).toBe(fact.id)
    expect(record).toMatchObject({
      revision: finding.createdAt,
      investigation: {
        question: "Does sleep matter?",
        nextStep: "One more game this week.",
      },
      evidence: [{ have: 6, need: 8 }],
      latestFinding: { id: "d1" },
    })
    expect(record?.hypotheses[0]?.history).toHaveLength(1)
  })

  it("gives the same records the same IDs, so nothing is sent twice", () => {
    expect(distillFacts(all).map(({ id }) => id)).toEqual(
      distillFacts(all).map(({ id }) => id)
    )
  })

  it("makes any change to the plan a new revision", () => {
    const before = handoffOf(all)!.fact.id
    const after = handoffOf({
      ...all,
      hypotheses: [{ ...hypothesis, updatedAt: Date.UTC(2026, 10, 7) }],
    })!.fact.id
    expect(after).not.toBe(before)
  })

  it("doesn't hand back a revision it took from another device", () => {
    const revision = handoffOf(all)!.record!.revision
    expect(
      handoffOf({ ...all, restored: { i1: { revision, evidence: [] } } })
    ).toBeUndefined()
  })

  it("carries another device's result forward until there's a local one", () => {
    const { record } = handoffOf({
      ...all,
      discoveries: [],
      investigations: [{ ...investigation, updatedAt: Date.UTC(2026, 10, 8) }],
      restored: {
        i1: {
          revision: Date.UTC(2026, 10, 6),
          evidence: [],
          latestFinding: readRecord(
            findingRecord,
            distillFacts(all).find(({ id }) => id === "finding:d1")!.text
          )!,
        },
      },
    })!
    expect(record?.latestFinding?.id).toBe("d1")
  })

  it("keeps a handoff within what one request carries", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      ...hypothesis,
      id: `h${index}`,
      statement: "x".repeat(300),
      rationale: "y".repeat(300),
      updatedAt: index,
    }))
    const { fact, record } = handoffOf({ ...all, hypotheses: many })!
    expect(fact.text.length).toBeLessThanOrEqual(MAX_FACT_CHARS)
    expect(record?.hypotheses[0]?.id).toBe("h39")
  })
})
