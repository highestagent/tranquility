import type { ModelMessage } from "ai"
import { describe, expect, it } from "vitest"

import { trimHistory } from "./trim-history"

const user = (text: string): ModelMessage => ({ role: "user", content: text })
const said = (text: string): ModelMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
})
const toolCall = (id: string): ModelMessage => ({
  role: "assistant",
  content: [
    {
      type: "tool-call",
      toolCallId: id,
      toolName: "getUserContext",
      input: {},
    },
  ],
})
const toolResult = (id: string): ModelMessage => ({
  role: "tool",
  content: [
    {
      type: "tool-result",
      toolCallId: id,
      toolName: "getUserContext",
      output: { type: "json", value: { sessions: 24 } },
    },
  ],
})

describe("trimHistory", () => {
  it("drops earlier tool activity and keeps the words", () => {
    expect(
      trimHistory([
        user("First"),
        toolCall("a"),
        toolResult("a"),
        said("First answer."),
        user("Second"),
      ])
    ).toEqual([user("First"), said("First answer."), user("Second")])
  })

  it("keeps the current turn exactly as it is", () => {
    const current = [user("Now"), toolCall("b"), toolResult("b"), said("Done.")]
    expect(trimHistory([user("Before"), toolResult("a"), ...current])).toEqual([
      user("Before"),
      ...current,
    ])
  })

  it("keeps text from a message that also made a tool call", () => {
    const mixed: ModelMessage = {
      role: "assistant",
      content: [
        { type: "text", text: "Let me check." },
        { type: "tool-call", toolCallId: "a", toolName: "x", input: {} },
      ],
    }
    expect(trimHistory([user("First"), mixed, user("Second")])).toEqual([
      user("First"),
      said("Let me check."),
      user("Second"),
    ])
  })

  it("drops reasoning from earlier messages", () => {
    const reasoned = {
      role: "assistant",
      content: [
        { type: "reasoning", text: "Thinking." },
        { type: "text", text: "Answer." },
      ],
    } as ModelMessage
    expect(trimHistory([user("First"), reasoned, user("Second")])).toEqual([
      user("First"),
      said("Answer."),
      user("Second"),
    ])
  })

  it("drops messages left empty", () => {
    const blank: ModelMessage = { role: "assistant", content: "  " }
    expect(trimHistory([user("First"), blank, user("Second")])).toEqual([
      user("First"),
      user("Second"),
    ])
  })

  it("keeps only the most recent earlier messages", () => {
    const history = Array.from({ length: 20 }, (_, index) => [
      user(`Question ${index}`),
      said(`Answer ${index}`),
    ]).flat()

    const trimmed = trimHistory([...history, user("Now")])

    expect(trimmed).toEqual([
      user("Question 17"),
      said("Answer 17"),
      user("Question 18"),
      said("Answer 18"),
      user("Question 19"),
      said("Answer 19"),
      user("Now"),
    ])
  })

  it("never starts with an assistant message", () => {
    const history = [
      said("Answer 0"),
      ...Array.from({ length: 3 }, (_, index) => [
        user(`Question ${index + 1}`),
        said(`Answer ${index + 1}`),
      ]).flat(),
    ]
    const trimmed = trimHistory([said("Oldest"), ...history, user("Now")])
    expect(trimmed[0]?.role).toBe("user")
    expect(trimmed.at(-1)).toEqual(user("Now"))
  })

  it("leaves a first turn alone", () => {
    expect(trimHistory([user("Only")])).toEqual([user("Only")])
    expect(trimHistory([])).toEqual([])
  })

  it("settles at one size, and trimming twice changes nothing", () => {
    const session = (turns: number) =>
      Array.from({ length: turns }, (_, index) => [
        user(`Question ${index}`),
        toolCall(`c${index}`),
        toolResult(`c${index}`),
        said(`Answer ${index}`),
      ]).flat()

    const short = trimHistory([...session(4), user("Now")])
    const long = trimHistory([...session(40), user("Now")])

    expect(long).toHaveLength(short.length)
    expect(trimHistory(long)).toEqual(long)
  })
})
