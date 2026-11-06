import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it } from "vitest"

import demoData from "@/fixtures/demo-data.json"

import { closeDb, DB_NAME } from "./db"
import {
  countAll,
  deleteAll,
  exportAll,
  importAll,
  InvalidImportError,
} from "./portability"
import { kv, measurements, newId, responses } from "./repositories"
import type { Measurement } from "./schemas"

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: newId(),
    sessionId: "s1",
    assessmentId: "go-no-go",
    protocolVersion: 1,
    seed: 42,
    startedAt: 100,
    completedAt: 200,
    inputType: "keyboard",
    valid: true,
    trials: [{ rt: 300 }],
    metrics: { medianRt: 300 },
    ...overrides,
  }
}

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("repositories", () => {
  it("stores and queries measurements in time order", async () => {
    await measurements.put(measurement({ startedAt: 300 }))
    await measurements.put(measurement({ startedAt: 100 }))
    await measurements.put(measurement({ assessmentId: "visual-search" }))

    const rows = await measurements.byAssessment("go-no-go")
    expect(rows.map((row) => row.startedAt)).toEqual([100, 300])
  })

  it("rejects records that fail validation", async () => {
    await expect(
      measurements.put({ ...measurement(), protocolVersion: 0 })
    ).rejects.toThrow()
    expect((await countAll()).measurements).toBe(0)
  })

  it("records a declined question as null", async () => {
    await responses.put({
      id: "r1",
      sessionId: "s1",
      questionId: "sleep.hours",
      bankVersion: 1,
      value: null,
      answeredAt: 1,
    })
    expect((await responses.bySession("s1"))[0]?.value).toBeNull()
  })
})

describe("portability", () => {
  it("round-trips everything through export and import", async () => {
    await measurements.put(measurement({ id: "m1" }))
    await kv.set("consent", { granted: true })

    const file = JSON.parse(JSON.stringify(await exportAll()))
    await deleteAll()
    expect((await countAll()).measurements).toBe(0)

    await importAll(file)
    expect((await measurements.get("m1"))?.metrics.medianRt).toBe(300)
    expect(await kv.get("consent")).toEqual({ granted: true })
  })

  it("leaves existing data untouched when the file is invalid", async () => {
    await measurements.put(measurement({ id: "m1" }))
    const file = JSON.parse(JSON.stringify(await exportAll()))
    file.data.measurements[0].metrics = "tampered"

    await expect(importAll(file)).rejects.toBeInstanceOf(InvalidImportError)
    await expect(importAll({ nope: true })).rejects.toBeInstanceOf(
      InvalidImportError
    )
    expect(await measurements.get("m1")).toBeDefined()
  })

  it("accepts the demo data file", async () => {
    await importAll(demoData)
    expect((await countAll()).measurements).toBe(48)
  })

  it("deletes everything", async () => {
    await measurements.put(measurement())
    await kv.set("a", 1)
    await deleteAll()
    const counts = await countAll()
    expect(Object.values(counts).every((count) => count === 0)).toBe(true)
  })
})
