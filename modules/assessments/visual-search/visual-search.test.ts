import { describe, expect, it } from "vitest"

import { buildPlan, PROTOCOL } from "./protocol"
import { scoreVisualSearch } from "./scoring"

describe("buildPlan", () => {
  it("is reproducible and balanced across conditions", () => {
    const plan = buildPlan(3, "test")
    expect(plan).toEqual(buildPlan(3, "test"))
    expect(plan).toHaveLength(48)
    for (const setSize of PROTOCOL.setSizes) {
      const trials = plan.filter((trial) => trial.setSize === setSize)
      expect(trials.filter((trial) => trial.present)).toHaveLength(8)
      expect(trials.filter((trial) => !trial.present)).toHaveLength(8)
    }
  })

  it("has exactly one target when present and none when absent", () => {
    for (const trial of buildPlan(3, "test")) {
      expect(trial.items).toHaveLength(trial.setSize)
      const targets = trial.items.filter((item) => item.isTarget)
      expect(targets).toHaveLength(trial.present ? 1 : 0)
    }
  })

  it("keeps every item on the board", () => {
    for (const trial of buildPlan(9, "test")) {
      for (const { x, y } of trial.items) {
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(100)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(100)
      }
    }
  })
})

describe("scoreVisualSearch", () => {
  const hit = (setSize: number, rtMs: number) => ({
    setSize,
    present: true,
    response: true,
    rtMs,
  })

  it("scores accuracy, speed, and search cost by hand", () => {
    const metrics = scoreVisualSearch([
      hit(8, 500),
      hit(16, 700),
      hit(24, 900),
      { setSize: 8, present: false, response: true, rtMs: 400 },
    ])
    expect(metrics.accuracy).toBe(0.75)
    expect(metrics.medianRt).toBe(700)
    expect(metrics.searchSlope).toBe(25)
  })

  it("counts a timeout as an error and omits speed metrics", () => {
    const metrics = scoreVisualSearch([
      { setSize: 8, present: true, response: null, rtMs: null },
    ])
    expect(metrics.accuracy).toBe(0)
    expect(metrics.medianRt).toBeUndefined()
    expect(metrics.searchSlope).toBeUndefined()
  })
})
