import { describe, expect, it } from "vitest"

import { nextLevel, scoreStaircase } from "./staircase"

describe("nextLevel", () => {
  const range = { min: 2, max: 5 }

  it("steps up after success and down after failure", () => {
    expect(nextLevel(3, true, range)).toBe(4)
    expect(nextLevel(3, false, range)).toBe(2)
  })

  it("stays within range", () => {
    expect(nextLevel(5, true, range)).toBe(5)
    expect(nextLevel(2, false, range)).toBe(2)
  })
})

describe("scoreStaircase", () => {
  it("averages only the settled trials", () => {
    const metrics = scoreStaircase(
      [
        { level: 3, correct: true },
        { level: 4, correct: true },
        { level: 5, correct: false },
        { level: 4, correct: false },
      ],
      2
    )
    expect(metrics.span).toBe(4.5)
    expect(metrics.maxLevel).toBe(4)
    expect(metrics.accuracy).toBe(0.5)
  })

  it("returns no metrics for an empty run", () => {
    expect(scoreStaircase([], 2)).toEqual({})
  })
})
