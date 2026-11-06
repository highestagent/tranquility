import { describe, expect, it } from "vitest"

import type { Discovery, Hypothesis, Investigation } from "@/modules/memory"

import { distillFacts } from "./distill"

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
  history: [],
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
  createdAt: 1,
  updatedAt: Date.UTC(2026, 10, 6),
}

const all = {
  discoveries: [finding],
  hypotheses: [hypothesis],
  investigations: [investigation],
}

describe("distillFacts", () => {
  it("captures a finding with its verdict and evidence", () => {
    const [fact] = distillFacts(all)
    expect(fact?.id).toBe("finding:d1")
    expect(fact?.text).toContain("Finding from 2026-11-06")
    expect(fact?.text).toContain("supported, on strong evidence")
    expect(fact?.text).toContain("More sleep comes with faster reactions")
  })

  it("gives the same facts the same IDs, so nothing is sent twice", () => {
    expect(distillFacts(all).map(({ id }) => id)).toEqual(
      distillFacts(all).map(({ id }) => id)
    )
  })

  it("makes a changed progress note into a new fact", () => {
    const before = distillFacts(all)[1]?.id
    const after = distillFacts({
      ...all,
      investigations: [{ ...investigation, progressNote: "Caffeine is next." }],
    })[1]?.id
    expect(after).not.toBe(before)
  })

  it("skips investigations with nothing to report yet", () => {
    const facts = distillFacts({
      ...all,
      discoveries: [],
      investigations: [{ ...investigation, progressNote: "" }],
    })
    expect(facts).toEqual([])
  })

  it("records a dropped hypothesis with its reason", () => {
    const facts = distillFacts({
      discoveries: [],
      investigations: [],
      hypotheses: [
        {
          ...hypothesis,
          status: "rejected",
          history: [{ at: 1, status: "rejected", note: "No longer relevant" }],
        },
      ],
    })
    expect(facts[0]?.text).toContain("Reason: No longer relevant")
  })

  it("keeps facts within what the service accepts", () => {
    const [fact] = distillFacts({
      ...all,
      discoveries: [{ ...finding, observed: "x".repeat(5000) }],
    })
    expect(fact?.text.length).toBeLessThanOrEqual(1200)
  })
})
