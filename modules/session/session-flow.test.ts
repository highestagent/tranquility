import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

import { deriveActivity } from "./activity"
import { REST_WINDOW_MS, shouldWake } from "./wake"

function assistant(parts: unknown[]): UIMessage {
  return { id: "a", role: "assistant", parts: parts as UIMessage["parts"] }
}

function user(text: string, hidden = false): UIMessage {
  return {
    id: "u",
    role: "user",
    metadata: hidden ? { hidden: true } : undefined,
    parts: [{ type: "text", text }],
  }
}

const tool = (name: string, input: object, state = "output-available") => ({
  type: `tool-${name}`,
  toolCallId: name,
  state,
  input,
})

describe("deriveActivity", () => {
  it("starts empty until the agent replies", () => {
    const activity = deriveActivity([user("Start", true)])
    expect(activity.stage).toBeNull()
    expect(activity.asked).toBeNull()
    expect(activity.completedTools).toBe(0)
  })

  it("follows the cycle from the agent's tool calls", () => {
    const activity = deriveActivity([
      user("Start", true),
      assistant([
        tool("getUserContext", { reason: "Reviewing" }),
        tool(
          "analyzePerformance",
          { reason: "Testing", mode: "relationship" },
          "input-available"
        ),
      ]),
    ])
    expect(activity.stage).toBe("analyze")
    expect(activity.visited).toEqual(["understand", "analyze"])
    expect(activity.caption).toBe("Testing")
    expect(activity.completedTools).toBe(1)
  })

  it("maps the pair being tested onto the map", () => {
    const activity = deriveActivity([
      assistant([
        tool("analyzePerformance", {
          reason: "Testing",
          mode: "relationship",
          factorId: "sleep.hours",
          assessmentId: "go-no-go",
          metricId: "medianRt",
        }),
        tool("saveInvestigation", { reason: "Saving" }),
      ]),
    ])
    expect(activity.focus).toEqual({
      domain: "sleep",
      assessmentId: "go-no-go",
    })
    expect(activity.stage).toBe("adapt")
  })

  it("only reports scanning while the scan is running", () => {
    const scan = { reason: "Scanning", mode: "scan" }
    expect(
      deriveActivity([
        assistant([tool("analyzePerformance", scan, "input-available")]),
      ]).scanning
    ).toBe(true)
    expect(
      deriveActivity([assistant([tool("analyzePerformance", scan)])]).scanning
    ).toBe(false)
  })

  it("treats only text after the last tool call as speech", () => {
    const activity = deriveActivity([
      assistant([
        { type: "text", text: "Let me check." },
        tool("getUserContext", { reason: "Reviewing" }),
        { type: "text", text: "You react faster" },
        { type: "text", text: " after more sleep." },
      ]),
    ])
    expect(activity.spoken).toBe("You react faster after more sleep.")
  })

  it("shows the user's own question but never the app's hidden turns", () => {
    expect(deriveActivity([user("Does sleep matter?")]).asked).toBe(
      "Does sleep matter?"
    )
    expect(deriveActivity([user("Internal", true)]).asked).toBeNull()
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
