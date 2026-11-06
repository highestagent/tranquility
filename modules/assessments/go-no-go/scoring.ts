import { inverseNormal, median, standardDeviation } from "@/lib/stats"

import { PROTOCOL, type GoNoGoTrial } from "./protocol"

export function scoreGoNoGo(trials: GoNoGoTrial[]): Record<string, number> {
  const go = trials.filter((trial) => trial.isGo)
  const noGo = trials.filter((trial) => !trial.isGo)
  const validRts = go.flatMap((trial) =>
    trial.rtMs !== null && trial.rtMs >= PROTOCOL.minValidRtMs
      ? [trial.rtMs]
      : []
  )
  const misses = go.length - validRts.length
  const falseAlarms = noGo.filter((trial) => trial.rtMs !== null).length

  const metrics: Record<string, number> = {}
  if (validRts.length > 0) metrics.medianRt = median(validRts)
  if (validRts.length > 1) metrics.rtVariability = standardDeviation(validRts)
  if (go.length > 0) metrics.omissionRate = misses / go.length
  if (noGo.length > 0) metrics.commissionRate = falseAlarms / noGo.length
  if (go.length > 0 && noGo.length > 0) {
    // Log-linear correction keeps z-scores finite at perfect rates.
    const hitRate = (validRts.length + 0.5) / (go.length + 1)
    const falseAlarmRate = (falseAlarms + 0.5) / (noGo.length + 1)
    metrics.dPrime = inverseNormal(hitRate) - inverseNormal(falseAlarmRate)
  }
  return metrics
}
