import { describe, expect, it } from "vitest"

import { summarizeCoverage } from "./coverage"

describe("summarizeCoverage", () => {
  it("counts answers and declines per question", () => {
    expect(
      summarizeCoverage([
        { questionId: "sleep.hours", value: 7 },
        { questionId: "sleep.hours", value: 8 },
        { questionId: "sleep.hours", value: null },
        { questionId: "mood.energy", value: null },
      ])
    ).toEqual([
      { questionId: "mood.energy", answered: 0, declined: 1 },
      { questionId: "sleep.hours", answered: 2, declined: 1 },
    ])
  })

  it("counts a zero as an answer, not a decline", () => {
    expect(
      summarizeCoverage([{ questionId: "sleep.nap_today", value: 0 }])
    ).toEqual([{ questionId: "sleep.nap_today", answered: 1, declined: 0 }])
  })

  it("has nothing to report without rows", () => {
    expect(summarizeCoverage([])).toEqual([])
  })

  it("reports counts only, never the values", () => {
    const [entry] = summarizeCoverage([
      { questionId: "stress.level", value: 4 },
    ])
    expect(Object.keys(entry!).sort()).toEqual([
      "answered",
      "declined",
      "questionId",
    ])
  })
})
