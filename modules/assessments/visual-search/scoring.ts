import { median } from "@/lib/stats"

import type { SearchTrial } from "./protocol"

export function scoreVisualSearch(
  trials: SearchTrial[]
): Record<string, number> {
  if (trials.length === 0) return {}
  const correct = trials.filter((trial) => trial.response === trial.present)
  const hits = correct.flatMap((trial) =>
    trial.present && trial.rtMs !== null
      ? [{ setSize: trial.setSize, rtMs: trial.rtMs }]
      : []
  )

  const metrics: Record<string, number> = {
    accuracy: correct.length / trials.length,
  }
  if (hits.length > 0) metrics.medianRt = median(hits.map((hit) => hit.rtMs))

  const slope = searchSlope(hits)
  if (slope !== null) metrics.searchSlope = slope
  return metrics
}

/** Least-squares slope of median reaction time on set size. */
function searchSlope(hits: { setSize: number; rtMs: number }[]) {
  const sizes = [...new Set(hits.map((hit) => hit.setSize))]
  if (sizes.length < 2) return null
  const points = sizes.map((size) => ({
    x: size,
    y: median(hits.filter((hit) => hit.setSize === size).map((h) => h.rtMs)),
  }))
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const numerator = points.reduce(
    (sum, p) => sum + (p.x - meanX) * (p.y - meanY),
    0
  )
  const denominator = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0)
  return numerator / denominator
}
