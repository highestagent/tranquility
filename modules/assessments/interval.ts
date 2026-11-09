import { measurements } from "@/modules/memory"
/** Conservative spacing avoids immediately repeated, practice-biased measurements. */
export const MIN_MEASUREMENT_INTERVAL_MS = 30 * 60 * 1000
export async function assessmentHistory(assessmentId: string) {
  const runs = await measurements.byAssessment(assessmentId)
  const completed = runs.filter((run) => run.valid)
  return {
    completed,
    availableAt: completed.reduce(
      (latest, run) =>
        Math.max(latest, run.completedAt + MIN_MEASUREMENT_INTERVAL_MS),
      0
    ),
  }
}

export async function nextMeasurementAt(assessmentId: string) {
  return (await assessmentHistory(assessmentId)).availableAt
}
