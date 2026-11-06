import { describe, expect, it } from "vitest"

import { niceTicks } from "./scale"

describe("niceTicks", () => {
  it("picks round values inside the range", () => {
    expect(niceTicks(291, 410)).toEqual([300, 350, 400])
    expect(niceTicks(4.1, 9.4)).toEqual([5, 7.5])
  })

  it("handles small ratios without floating-point noise", () => {
    expect(niceTicks(0.1, 0.9)).toEqual([0.25, 0.5, 0.75])
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  it("copes with a flat range", () => {
    expect(niceTicks(5, 5)).toEqual([5])
  })
})
