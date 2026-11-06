import { mean } from "@/lib/stats"

/** Trial shape shared by adaptive span games. */
export interface StaircaseTrial {
  level: number
  correct: boolean
}

/** One-up, one-down: difficulty settles near the user's 50% threshold. */
export function nextLevel(
  level: number,
  correct: boolean,
  range: { min: number; max: number }
) {
  const next = correct ? level + 1 : level - 1
  return Math.min(range.max, Math.max(range.min, next))
}

export function scoreStaircase(
  trials: StaircaseTrial[],
  thresholdTrials: number
): Record<string, number> {
  if (trials.length === 0) return {}
  const correct = trials.filter((trial) => trial.correct)
  // Early trials reflect the fixed start level, not the user's ability.
  const settled = trials.slice(-thresholdTrials)
  return {
    span: mean(settled.map((trial) => trial.level)),
    maxLevel: Math.max(0, ...correct.map((trial) => trial.level)),
    accuracy: correct.length / trials.length,
  }
}
