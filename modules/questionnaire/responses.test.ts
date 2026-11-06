import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it } from "vitest"

import { closeDb, responses } from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import { askedThisSession, loadSessionAnswers, saveAnswer } from "./responses"

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("saveAnswer", () => {
  it("overwrites rather than duplicates, whatever the timing", async () => {
    await Promise.all([
      saveAnswer("stress.level", 3),
      saveAnswer("stress.level", 3),
      saveAnswer("stress.level", 4),
    ])
    const rows = await responses.byQuestion("stress.level")
    expect(rows).toHaveLength(1)
  })

  it("lets a changed answer replace the old one", async () => {
    await saveAnswer("mood.energy", 2)
    await saveAnswer("mood.energy", 5)
    const [row] = await responses.byQuestion("mood.energy")
    expect(row?.value).toBe(5)
  })
})

describe("loadSessionAnswers", () => {
  it("restores answers and declines for the questions asked", async () => {
    await saveAnswer("mood.energy", 4)
    await saveAnswer("sleep.quality", null)
    await saveAnswer("stress.level", 2)

    const restored = await loadSessionAnswers(["mood.energy", "sleep.quality"])
    expect(restored).toEqual({ "mood.energy": 4, "sleep.quality": null })
    expect(await askedThisSession()).toContain("stress.level")
  })
})
