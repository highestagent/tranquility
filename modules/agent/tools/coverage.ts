import type { QuestionResponse } from "@/modules/memory"

export interface QuestionCoverage {
  questionId: string
  answered: number
  declined: number
}

/**
 * How much data exists per question, without any of the values. Questions with
 * no rows are left out.
 */
export function summarizeCoverage(
  rows: readonly Pick<QuestionResponse, "questionId" | "value">[]
): QuestionCoverage[] {
  const counts = new Map<string, QuestionCoverage>()
  for (const { questionId, value } of rows) {
    const entry = counts.get(questionId) ?? {
      questionId,
      answered: 0,
      declined: 0,
    }
    if (value === null) entry.declined++
    else entry.answered++
    counts.set(questionId, entry)
  }
  return [...counts.values()].sort((a, b) =>
    a.questionId.localeCompare(b.questionId)
  )
}
