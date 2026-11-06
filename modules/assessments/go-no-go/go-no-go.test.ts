import { describe, expect, it } from "vitest"

import { buildPlan, PROTOCOL } from "./protocol"
import { scoreGoNoGo } from "./scoring"

const trial = (isGo: boolean, rtMs: number | null) => ({
  isGo,
  isiMs: 1000,
  rtMs,
})

describe("buildPlan", () => {
  it("is reproducible from its seed", () => {
    expect(buildPlan(7, "test")).toEqual(buildPlan(7, "test"))
    expect(buildPlan(7, "test")).not.toEqual(buildPlan(8, "test"))
  })

  it("follows the protocol's trial mix and timing", () => {
    const plan = buildPlan(7, "test")
    expect(plan).toHaveLength(PROTOCOL.testTrials)
    expect(plan.filter((t) => !t.isGo)).toHaveLength(15)
    for (const { isiMs } of plan) {
      expect(isiMs).toBeGreaterThanOrEqual(PROTOCOL.isiMinMs)
      expect(isiMs).toBeLessThanOrEqual(PROTOCOL.isiMaxMs)
    }
  })
})

describe("scoreGoNoGo", () => {
  it("scores a hand-computed run", () => {
    const metrics = scoreGoNoGo([
      trial(true, 300),
      trial(true, 400),
      trial(true, 500),
      trial(true, null),
      trial(false, null),
      trial(false, 250),
    ])
    expect(metrics.medianRt).toBe(400)
    expect(metrics.rtVariability).toBe(100)
    expect(metrics.omissionRate).toBe(0.25)
    expect(metrics.commissionRate).toBe(0.5)
    // z(3.5/5) - z(1.5/3) = z(0.7) - 0
    expect(metrics.dPrime).toBeCloseTo(0.5244, 3)
  })

  it("treats anticipations as misses, not reactions", () => {
    const metrics = scoreGoNoGo([trial(true, 50), trial(true, 300)])
    expect(metrics.medianRt).toBe(300)
    expect(metrics.omissionRate).toBe(0.5)
  })

  it("omits metrics it cannot compute instead of producing NaN", () => {
    const metrics = scoreGoNoGo([trial(true, null), trial(false, null)])
    expect(metrics.medianRt).toBeUndefined()
    expect(metrics.rtVariability).toBeUndefined()
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true)
  })
})
