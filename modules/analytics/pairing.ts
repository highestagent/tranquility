import { median } from "@/lib/stats"
import type { Measurement, QuestionResponse } from "@/modules/memory"

export interface Observation {
  x: number
  y: number
  /** Position in time, used to remove practice effects. */
  order: number
  sessionId: string
  measurementIds: string[]
}

/**
 * Lines up one factor with one metric, session by session. Invalid runs,
 * declined questions, and runs from other protocol versions are left out, so
 * only like-for-like results are compared.
 */
export function pairObservations(
  runs: readonly Measurement[],
  answers: readonly QuestionResponse[],
  metricId: string
): Observation[] {
  const currentVersion = Math.max(0, ...runs.map((run) => run.protocolVersion))

  const runsBySession = new Map<string, Measurement[]>()
  for (const run of runs) {
    if (!run.valid || run.protocolVersion !== currentVersion) continue
    if (run.metrics[metricId] === undefined) continue
    const group = runsBySession.get(run.sessionId) ?? []
    group.push(run)
    runsBySession.set(run.sessionId, group)
  }

  const observations: Omit<Observation, "order">[] = []
  const startedAt = new Map<string, number>()
  for (const [sessionId, group] of runsBySession) {
    const answer = answers.find(
      (row) => row.sessionId === sessionId && row.value !== null
    )
    if (!answer || answer.value === null) continue
    startedAt.set(sessionId, Math.min(...group.map((run) => run.startedAt)))
    observations.push({
      x: answer.value,
      y: median(group.map((run) => run.metrics[metricId]!)),
      sessionId,
      measurementIds: group.map((run) => run.id),
    })
  }

  return observations
    .sort(
      (a, b) => startedAt.get(a.sessionId)! - startedAt.get(b.sessionId)!
    )
    .map((observation, order) => ({ ...observation, order }))
}
