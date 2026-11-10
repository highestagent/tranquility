import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { PDFDocument } from "pdf-lib"
import { beforeEach, expect, it } from "vitest"

import { closeDb, discoveries, sessions } from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import { buildReport } from "./report"

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

it("builds a PDF, even from text the standard fonts can't draw", async () => {
  await sessions.put({ id: "s1", startedAt: Date.UTC(2026, 10, 1) })
  await discoveries.put({
    id: "d1",
    investigationId: "i1",
    hypothesisId: "h1",
    analysisIds: ["a1"],
    grade: "moderate",
    verdict: "supported",
    observed: "You react faster after ≥ 7 hours of sleep 🙂",
    evidence: "12 comparable sessions → correlation of -0.62.",
    reliability: "Moderate evidence.",
    uncertainty: "Stress could also play a part.",
    nextStep: "Check stress.",
    createdAt: Date.UTC(2026, 10, 2),
  })
  const bytes = await buildReport()
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
  const doc = await PDFDocument.load(bytes)
  expect(doc.getTitle()).toBe("Tranquility research report")
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
})
