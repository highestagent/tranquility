import { describe, expect, it } from "vitest"

import { createRandom } from "@/lib/random"

import { computeBaseline, robustZ } from "./baseline"
import { gradeRelationship } from "./grading"
import {
  benjaminiHochberg,
  cliffsDelta,
  ranks,
  residualize,
  spearman,
  testRelationship,
  type RelationshipResult,
} from "./relationships"

describe("descriptive statistics", () => {
  it("gives ties an average rank", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
  })

  it("computes Spearman from known values", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1)
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1)
    // Hand-computed: ranks differ by [0, 1, -1, 0], rho = 1 - 6*2/(4*15) = 0.8
    expect(spearman([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(0.8)
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull()
  })

  it("computes Cliff's delta from known values", () => {
    expect(cliffsDelta([1, 1, 0, 0], [5, 6, 1, 2])).toBe(1)
    expect(cliffsDelta([1, 1, 0, 0], [1, 2, 5, 6])).toBe(-1)
    expect(cliffsDelta([1, 0], [3, 3])).toBe(0)
  })

  it("removes a linear trend", () => {
    const residuals = residualize([2, 4, 6, 8], [1, 2, 3, 4])
    for (const residual of residuals) expect(residual).toBeCloseTo(0)
  })

  it("computes Benjamini-Hochberg from hand-worked values", () => {
    const adjusted = benjaminiHochberg([0.01, 0.04, 0.03, 0.2])
    expect(adjusted[0]).toBeCloseTo(0.04)
    expect(adjusted[1]).toBeCloseTo(0.0533, 3)
    expect(adjusted[2]).toBeCloseTo(0.0533, 3)
    expect(adjusted[3]).toBeCloseTo(0.2)
  })

  it("computes a robust baseline and ignores an outlier", () => {
    const baseline = computeBaseline([10, 11, 12, 13, 500])!
    expect(baseline.median).toBe(12)
    expect(baseline.mad).toBe(1)
    expect(robustZ(12, baseline)).toBe(0)
    expect(computeBaseline([1, 2])).toBeNull()
  })
})

function simulate(
  n: number,
  seed: number,
  makeY: (x: number, order: number, noise: number) => number,
  makeX: (order: number, random: () => number) => number
) {
  const random = createRandom(seed)
  return Array.from({ length: n }, (_, order) => {
    const x = makeX(order, random)
    return { x, y: makeY(x, order, random() - 0.5), order }
  })
}

describe("testRelationship", () => {
  it("finds a real relationship", () => {
    const result = testRelationship(
      simulate(
        24,
        1,
        (x, _order, noise) => 400 - 20 * x + 30 * noise,
        (_order, random) => 4 + random() * 5
      ),
      1
    )!
    expect(result.method).toBe("spearman")
    expect(result.effect).toBeLessThan(-0.5)
    expect(result.pValue).toBeLessThan(0.01)
    expect(result.ciHigh!).toBeLessThan(0)
    expect(gradeRelationship(result)).toBe("strong")
  })

  it("doesn't mistake a practice effect for a finding", () => {
    // Both variables drift over time, but neither affects the other.
    const observations = simulate(
      24,
      2,
      (_x, order, noise) => 500 - 8 * order + 20 * noise,
      (order, random) => order * 0.2 + random()
    )
    const unadjusted = spearman(
      observations.map((o) => o.x),
      observations.map((o) => o.y)
    )!
    expect(unadjusted).toBeLessThan(-0.8)

    const result = testRelationship(observations, 2)!
    expect(Math.abs(result.effect)).toBeLessThan(0.3)
    expect(gradeRelationship(result)).toBe("weak")
  })

  it("handles binary factors with a permutation test", () => {
    const result = testRelationship(
      simulate(
        20,
        3,
        (x, _order, noise) => 300 + 60 * x + 20 * noise,
        (order) => order % 2
      ),
      3
    )!
    expect(result.method).toBe("permutation")
    expect(result.effect).toBeGreaterThan(0.8)
    expect(result.pValue).toBeLessThan(0.01)
  })

  it("is deterministic for a given seed", () => {
    const data = simulate(
      12,
      4,
      (x, _order, noise) => x + noise,
      (_order, random) => random() * 5
    )
    expect(testRelationship(data, 9)).toEqual(testRelationship(data, 9))
  })
})

describe("gradeRelationship", () => {
  const result = (overrides: Partial<RelationshipResult>) =>
    ({
      method: "spearman",
      n: 24,
      effect: -0.6,
      ciLow: -0.8,
      ciHigh: -0.3,
      pValue: 0.001,
      earlyEffect: -0.6,
      lateEffect: -0.6,
      ...overrides,
    }) satisfies RelationshipResult

  it("needs enough data for each grade", () => {
    expect(gradeRelationship(result({}))).toBe("strong")
    expect(gradeRelationship(result({ n: 14 }))).toBe("moderate")
    expect(gradeRelationship(result({ n: 5 }))).toBe("insufficient")
  })

  it("caps the grade when the interval spans zero or p is corrected", () => {
    expect(gradeRelationship(result({ ciHigh: 0.1 }))).toBe("weak")
    expect(gradeRelationship(result({}), 0.2)).toBe("weak")
  })

  it("flags a relationship that reverses over time", () => {
    expect(
      gradeRelationship(result({ earlyEffect: -0.6, lateEffect: 0.5 }))
    ).toBe("contradictory")
  })
})
