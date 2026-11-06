import { describe, expect, it } from "vitest"

import { buildSequence, isCorrect } from "./protocol"

describe("buildSequence", () => {
  it("is reproducible and never repeats a tile", () => {
    const sequence = buildSequence(5, 2, 7)
    expect(sequence).toEqual(buildSequence(5, 2, 7))
    expect(new Set(sequence).size).toBe(7)
  })
})

describe("isCorrect", () => {
  it("requires the exact order", () => {
    expect(isCorrect([4, 2, 8], [4, 2, 8])).toBe(true)
    expect(isCorrect([4, 2, 8], [2, 4, 8])).toBe(false)
  })
})
