import { describe, expect, it } from "vitest"

import { getQuestion, QUESTIONS, validateAnswer, type Question } from "./bank"
import {
  coreQuestionIds,
  MAX_QUESTIONS_PER_ASK,
  resolveQuestions,
} from "./selection"

describe("question bank", () => {
  it("has unique IDs", () => {
    const ids = QUESTIONS.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("covers every domain in the core and the full bank", () => {
    const domains = new Set(QUESTIONS.map((question) => question.domain))
    expect(domains).toEqual(
      new Set(["sleep", "mood", "stress", "lifestyle", "environment"])
    )
    expect(coreQuestionIds().length).toBeGreaterThan(0)
  })
})

describe("validateAnswer", () => {
  const byId = (id: string) => getQuestion(id) as Question

  it("enforces each question's scale", () => {
    expect(validateAnswer(byId("sleep.quality"), 5)).toBeNull()
    expect(validateAnswer(byId("sleep.quality"), 6)).toMatch(/scale/)
    expect(validateAnswer(byId("sleep.nap_today"), 2)).toMatch(/yes or no/)
    expect(validateAnswer(byId("sleep.hours"), 7.5)).toBeNull()
    expect(validateAnswer(byId("sleep.hours"), 30)).toMatch(/0 to 16/)
    expect(validateAnswer(byId("sleep.hours"), Number.NaN)).toMatch(/number/)
  })
})

describe("resolveQuestions", () => {
  it("drops duplicates and anything already asked this session", () => {
    expect(
      resolveQuestions(
        ["sleep.hours", "sleep.hours", "mood.energy"],
        new Set(["mood.energy"])
      )
    ).toEqual(["sleep.hours"])
  })

  it("never asks too many at once", () => {
    const all = QUESTIONS.map((question) => question.id)
    expect(resolveQuestions(all, new Set())).toHaveLength(MAX_QUESTIONS_PER_ASK)
  })
})
