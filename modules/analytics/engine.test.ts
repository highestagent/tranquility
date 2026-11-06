import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it } from "vitest"

import demoData from "@/fixtures/demo-data.json"
import { createRandom } from "@/lib/random"
import {
  closeDb,
  importAll,
  measurements,
  responses,
  sessions,
} from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import {
  analyzeRelationship,
  scanRelationships,
  summarizeMetric,
} from "./engine"
import { pairObservations } from "./pairing"

const METRIC = { assessmentId: "go-no-go", metricId: "medianRt" }

async function seedSessions(
  count: number,
  build: (
    index: number,
    random: () => number
  ) => {
    answers: Record<string, number | null>
    rt: number
    valid?: boolean
  }
) {
  const random = createRandom(99)
  for (let index = 0; index < count; index++) {
    const id = `s${index}`
    const { answers, rt, valid = true } = build(index, random)
    await sessions.put({ id, startedAt: 1000 + index })
    await measurements.put({
      id: `m${index}`,
      sessionId: id,
      assessmentId: METRIC.assessmentId,
      protocolVersion: 1,
      seed: index,
      startedAt: 1000 + index,
      completedAt: 2000 + index,
      inputType: "keyboard",
      valid,
      trials: [],
      metrics: valid ? { medianRt: rt } : {},
    })
    for (const [questionId, value] of Object.entries(answers)) {
      await responses.put({
        id: `${id}-${questionId}`,
        sessionId: id,
        questionId,
        bankVersion: 1,
        value,
        answeredAt: 1000 + index,
      })
    }
  }
}

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("pairObservations", () => {
  const run = (overrides: object) =>
    ({
      id: "m",
      sessionId: "a",
      assessmentId: "g",
      protocolVersion: 2,
      seed: 1,
      startedAt: 1,
      completedAt: 2,
      inputType: "keyboard",
      valid: true,
      trials: [],
      metrics: { rt: 100 },
      ...overrides,
    }) as Parameters<typeof pairObservations>[0][number]
  const answer = (sessionId: string, value: number | null) => ({
    id: sessionId,
    sessionId,
    questionId: "q",
    bankVersion: 1,
    value,
    answeredAt: 1,
  })

  it("leaves out invalid runs, old protocols, and declined answers", () => {
    const observations = pairObservations(
      [
        run({ id: "keep", sessionId: "a" }),
        run({ id: "invalid", sessionId: "b", valid: false }),
        run({ id: "old", sessionId: "c", protocolVersion: 1 }),
        run({ id: "declined", sessionId: "d" }),
      ],
      [answer("a", 5), answer("b", 5), answer("c", 5), answer("d", null)],
      "rt"
    )
    expect(observations.map((o) => o.measurementIds)).toEqual([["keep"]])
  })

  it("combines repeat runs in a session using their median", () => {
    const observations = pairObservations(
      [
        run({ id: "1", metrics: { rt: 100 } }),
        run({ id: "2", metrics: { rt: 300 } }),
        run({ id: "3", metrics: { rt: 110 } }),
      ],
      [answer("a", 5)],
      "rt"
    )
    expect(observations).toHaveLength(1)
    expect(observations[0]!.y).toBe(110)
  })
})

describe("analyzeRelationship", () => {
  it("reports insufficient evidence instead of guessing", async () => {
    await seedSessions(5, (index) => ({
      answers: { "sleep.hours": index },
      rt: 400 - index,
    }))
    const analysis = await analyzeRelationship("sleep.hours", METRIC)
    expect(analysis.grade).toBe("insufficient")
    expect(analysis.effect).toBeNull()
    expect(analysis.n).toBe(5)
  })

  it("finds a planted relationship and persists it", async () => {
    await seedSessions(24, (_index, random) => {
      const hours = 4 + random() * 5
      return {
        answers: { "sleep.hours": hours },
        rt: 450 - 20 * hours + (random() - 0.5) * 30,
      }
    })
    const analysis = await analyzeRelationship("sleep.hours", METRIC)
    expect(analysis.grade).toBe("strong")
    expect(analysis.direction).toBe("negative")
    expect(analysis.measurementIds).toHaveLength(24)
  })

  it("rejects a rare binary answer as untestable", async () => {
    await seedSessions(10, (index) => ({
      answers: { "sleep.nap_today": index === 0 ? 1 : 0 },
      rt: 400 + index,
    }))
    const analysis = await analyzeRelationship("sleep.nap_today", METRIC)
    expect(analysis.grade).toBe("insufficient")
    expect(analysis.notes[0]).toMatch(/rarer/)
  })
})

describe("scanRelationships", () => {
  it("finds the real factor and not the unrelated one", async () => {
    await seedSessions(24, (_index, random) => {
      const hours = 4 + random() * 5
      return {
        answers: {
          "sleep.hours": hours,
          "mood.valence": 1 + Math.floor(random() * 5),
        },
        rt: 450 - 20 * hours + (random() - 0.5) * 30,
      }
    })
    const { tested, findings } = await scanRelationships(
      ["sleep.hours", "mood.valence"],
      [METRIC]
    )
    expect(tested).toBe(2)
    expect(findings[0]?.factorId).toBe("sleep.hours")
    expect(findings[0]?.notes.join(" ")).toMatch(/corrected/)
  })
})

describe("demo data", () => {
  it("reveals the planted pattern and nothing else strong", async () => {
    await importAll(demoData)
    const { tested, findings } = await scanRelationships(
      ["sleep.hours", "stress.level", "mood.valence"],
      [METRIC, { assessmentId: "visual-search", metricId: "medianRt" }]
    )
    expect(tested).toBe(6)
    expect(findings[0]).toMatchObject({
      factorId: "sleep.hours",
      metric: METRIC,
      grade: "strong",
      direction: "negative",
    })
    expect(findings.slice(1).every((f) => f.grade !== "strong")).toBe(true)
  })
})

describe("summarizeMetric", () => {
  it("compares the latest run with the baseline before it", async () => {
    await seedSessions(5, (index) => ({
      answers: {},
      rt: [300, 310, 320, 330, 500][index]!,
    }))
    const summary = await summarizeMetric(METRIC)
    expect(summary.latest).toBe(500)
    expect(summary.baseline?.median).toBe(315)
    expect(summary.latestZ).toBeGreaterThan(3)
  })
})
