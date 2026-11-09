import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

import { deriveActivity } from "./activity"
import { REST_WINDOW_MS, shouldWake } from "./wake"

function assistant(parts: unknown[]): UIMessage {
  return { id: "a", role: "assistant", parts: parts as UIMessage["parts"] }
}

describe("deriveActivity", () => {
  it("keeps the latest available tool reason while the agent works", () => {
    const activity = deriveActivity([
      assistant([
        { type: "tool-getUserContext", input: { reason: "Reviewing" } },
        { type: "tool-analyzePerformance", input: { reason: "Analyzing" } },
        { type: "tool-saveInvestigation" },
      ]),
    ])
    expect(activity).toEqual({ caption: "Analyzing", spoken: null })
  })

  it("treats only text after the last tool call as speech", () => {
    const activity = deriveActivity([
      assistant([
        { type: "text", text: "Let me check." },
        { type: "tool-getUserContext", input: { reason: "Reviewing" } },
        { type: "text", text: "You react faster" },
        { type: "text", text: " after more sleep." },
      ]),
    ])
    expect(activity.spoken).toBe("You react faster after more sleep.")
  })
})

describe("shouldWake", () => {
  const now = 1_000_000_000
  const rest = { at: now - 1000, spoken: null }

  it("wakes the first time", () => {
    expect(shouldWake({ rest: null, latestDataAt: 0, now })).toBe(true)
  })

  it("rests when nothing has changed", () => {
    expect(shouldWake({ rest, latestDataAt: rest.at - 1, now })).toBe(false)
  })

  it("wakes for new data, such as a game played from the Games page", () => {
    expect(shouldWake({ rest, latestDataAt: rest.at + 1, now })).toBe(true)
  })

  it("wakes again after a long rest", () => {
    expect(
      shouldWake({
        rest: { at: now - REST_WINDOW_MS, spoken: null },
        latestDataAt: 0,
        now,
      })
    ).toBe(true)
  })
})
