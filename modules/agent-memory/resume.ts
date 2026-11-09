import { discoveries, investigations, type Discovery } from "@/modules/memory"

import { getRestoredHandoffs } from "./sync"

/** The open question, its last verified result, and what would help next. */
export interface ResumePoint {
  question: string
  nextStep?: string
  nextMeasurementAt?: number
  lastResult?: Pick<Discovery, "observed" | "verdict" | "grade" | "createdAt">
}

/** Where the most recent active investigation stands, on whichever device it ran. */
export async function loadResumePoint(): Promise<ResumePoint | null> {
  const [rows, restored] = await Promise.all([
    investigations.list(),
    getRestoredHandoffs(),
  ])
  const active = rows
    .filter((row) => row.status === "active")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (!active) return null
  const local = (await discoveries.byInvestigation(active.id)).sort(
    (a, b) => b.createdAt - a.createdAt
  )[0]
  const lastResult = local ?? restored[active.id]?.latestFinding
  return {
    question: active.question,
    nextStep: active.nextStep,
    nextMeasurementAt: active.nextMeasurementAt,
    lastResult: lastResult && {
      observed: lastResult.observed,
      verdict: lastResult.verdict,
      grade: lastResult.grade,
      createdAt: lastResult.createdAt,
    },
  }
}
