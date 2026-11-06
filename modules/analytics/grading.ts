import type { EvidenceGrade } from "@/modules/memory"

import type { RelationshipResult } from "./relationships"

/**
 * Evidence thresholds. These are reasoning heuristics for comparing one
 * person's data with itself. They are not validated clinical cut-offs.
 */
export const THRESHOLDS = {
  minPairs: 8,
  minGroupSize: 3,
  moderate: { effect: 0.3, n: 12 },
  strong: { effect: 0.5, n: 20 },
  /** Below this, an effect is too small to count as a finding. */
  negligibleEffect: 0.2,
  contradictory: { effect: 0.3, n: 16 },
  /** A multiple-comparison-adjusted p above this caps the grade at weak. */
  significance: 0.05,
} as const

export function gradeRelationship(
  result: RelationshipResult,
  adjustedP = result.pValue
): EvidenceGrade {
  const { n, effect, ciLow, ciHigh, earlyEffect, lateEffect } = result
  if (n < THRESHOLDS.minPairs) return "insufficient"

  if (
    n >= THRESHOLDS.contradictory.n &&
    earlyEffect !== null &&
    lateEffect !== null &&
    Math.sign(earlyEffect) !== Math.sign(lateEffect) &&
    Math.abs(earlyEffect) >= THRESHOLDS.contradictory.effect &&
    Math.abs(lateEffect) >= THRESHOLDS.contradictory.effect
  ) {
    return "contradictory"
  }

  const excludesZero =
    ciLow !== null && ciHigh !== null && (ciLow > 0 || ciHigh < 0)
  const size = Math.abs(effect)
  if (excludesZero && adjustedP < THRESHOLDS.significance) {
    if (size >= THRESHOLDS.strong.effect && n >= THRESHOLDS.strong.n) {
      return "strong"
    }
    if (size >= THRESHOLDS.moderate.effect && n >= THRESHOLDS.moderate.n) {
      return "moderate"
    }
  }
  return "weak"
}

export function directionOf(effect: number) {
  if (Math.abs(effect) < THRESHOLDS.negligibleEffect) return "none" as const
  return effect > 0 ? ("positive" as const) : ("negative" as const)
}
