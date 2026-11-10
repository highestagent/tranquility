import type { Analysis, Hypothesis } from "@/modules/memory"

export type Verdict = "supported" | "refuted" | "inconclusive"

/** A CI inside this band rules out a meaningful effect. */
const NEGLIGIBLE_BAND = 0.3
const MIN_N_TO_RULE_OUT = 20

/**
 * Turns measured evidence into a verdict. This is code rather than the model's
 * judgment, so a hypothesis can't be declared supported without the data.
 */
export function decideVerdict(
  expected: Hypothesis["expectedDirection"],
  analysis: Pick<Analysis, "grade" | "direction" | "n" | "ciLow" | "ciHigh">
): Verdict {
  const { grade, direction, n, ciLow, ciHigh } = analysis

  if (grade === "moderate" || grade === "strong") {
    if (expected === "any" || direction === expected) return "supported"
    return "refuted"
  }

  const ruledOut =
    n >= MIN_N_TO_RULE_OUT &&
    ciLow !== null &&
    ciHigh !== null &&
    ciLow > -NEGLIGIBLE_BAND &&
    ciHigh < NEGLIGIBLE_BAND
  if (grade === "weak" && ruledOut) return "refuted"

  return "inconclusive"
}

/**
 * What a verdict found. "Refuted" covers two different results: a clear
 * effect the other way, or enough data to rule out a meaningful one.
 */
export type Outcome = "supported" | "opposite" | "no-link" | "unclear"

export function verdictOutcome({
  verdict,
  grade,
}: {
  verdict: Verdict
  grade: Analysis["grade"]
}): Outcome {
  if (verdict === "supported") return "supported"
  if (verdict === "inconclusive") return "unclear"
  return grade === "moderate" || grade === "strong" ? "opposite" : "no-link"
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  supported: "Supported",
  opposite: "Opposite of expected",
  "no-link": "No link",
  unclear: "Unclear",
}

export const GRADE_WORDS: Record<Analysis["grade"], string> = {
  insufficient: "too little data",
  weak: "weak evidence",
  moderate: "moderate evidence",
  strong: "strong evidence",
  contradictory: "contradictory evidence",
}
