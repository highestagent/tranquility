import { describe, expect, it } from "vitest"

import type { Discovery } from "@/modules/memory"

import { latestFindings, type DiscoveryView } from "./discovery-data"

function view(id: string, hypothesisId: string, createdAt: number) {
  return {
    discovery: { id, hypothesisId, createdAt } as Discovery,
    hypothesis: undefined,
    analysis: undefined,
    points: [],
    earlier: [],
  } satisfies DiscoveryView
}

describe("latestFindings", () => {
  it("shows each relationship once, with its earlier checks newest first", () => {
    const views = [
      view("sleep-1", "sleep", 1),
      view("mood-1", "mood", 2),
      view("sleep-3", "sleep", 3),
      view("sleep-2", "sleep", 2),
    ]
    const latest = latestFindings(views)
    expect(latest.map(({ discovery }) => discovery.id).sort()).toEqual([
      "mood-1",
      "sleep-3",
    ])
    const sleep = latest.find(({ discovery }) => discovery.id === "sleep-3")
    expect(sleep?.earlier.map(({ id }) => id)).toEqual(["sleep-2", "sleep-1"])
  })
})
