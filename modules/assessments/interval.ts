import { measurements } from "@/modules/memory"
/** Conservative spacing avoids immediately repeated, practice-biased measurements. */
export const MIN_MEASUREMENT_INTERVAL_MS = 30 * 60 * 1000
export async function nextMeasurementAt(assessmentId: string) {
  const runs = await measurements.byAssessment(assessmentId)
  return Math.max(
    0,
    ...runs
      .filter((r) => r.valid)
      .map((r) => r.completedAt + MIN_MEASUREMENT_INTERVAL_MS)
  )
}
