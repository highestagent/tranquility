import { QUESTIONS, type QuestionId } from "./bank"

export const MAX_QUESTIONS_PER_ASK = 5

/**
 * Decides what to actually ask. Questions already answered or declined this
 * session are dropped, since a repeat could only add noise or nagging.
 */
export function resolveQuestions(
  requested: readonly QuestionId[],
  askedThisSession: ReadonlySet<string>
): QuestionId[] {
  return [...new Set(requested)]
    .filter((id) => !askedThisSession.has(id))
    .slice(0, MAX_QUESTIONS_PER_ASK)
}

export function coreQuestionIds(): QuestionId[] {
  return QUESTIONS.filter((question) => question.core).map(({ id }) => id)
}
