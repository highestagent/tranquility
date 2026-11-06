import { describe, expect, it } from "vitest"

import { buildPattern, isCorrect, PROTOCOL } from "./protocol"

describe("buildPattern", () => {
  it("is reproducible and has distinct, in-range tiles", () => {
    const pattern = buildPattern(11, 3, 6)
    expect(pattern).toEqual(buildPattern(11, 3, 6))
    expect(new Set(pattern).size).toBe(6)
    const tileCount = PROTOCOL.gridSize ** 2
    expect(pattern.every((tile) => tile >= 0 && tile < tileCount)).toBe(true)
  })

  it("varies between trials", () => {
    expect(buildPattern(11, 3, 6)).not.toEqual(buildPattern(11, 4, 6))
  })
})

describe("isCorrect", () => {
  it("ignores selection order", () => {
    expect(isCorrect([1, 2, 3], [3, 1, 2])).toBe(true)
  })

  it("rejects a different tile", () => {
    expect(isCorrect([1, 2, 3], [1, 2, 4])).toBe(false)
  })
})
