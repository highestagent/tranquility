import { getCurrentSession, responses } from "@/modules/memory"

import { BANK_VERSION, type QuestionId } from "./bank"

export type Answers = Partial<Record<QuestionId, number | null>>

/**
 * Stores one answer as soon as it's given, so nothing is lost if the page
 * closes. The ID is stable per session and question, which makes repeats and
 * changed answers overwrite rather than add a row. `null` records a decline.
 */
export async function saveAnswer(
  questionId: QuestionId,
  value: number | null,
  sessionId?: string
) {
  const session = sessionId ? { id: sessionId } : await getCurrentSession()
  await responses.put({
    id: `${session.id}:${questionId}`,
    sessionId: session.id,
    questionId,
    bankVersion: BANK_VERSION,
    value,
    answeredAt: Date.now(),
  })
}

/** What's already been answered this session, for resuming a set of questions. */
export async function loadSessionAnswers(
  questionIds: readonly QuestionId[],
  sessionId?: string
): Promise<Answers> {
  const session = sessionId ? { id: sessionId } : await getCurrentSession()
  const rows = await responses.bySession(session.id)
  const answers: Answers = {}
  for (const row of rows) {
    const id = row.questionId as QuestionId
    if (questionIds.includes(id)) answers[id] = row.value
  }
  return answers
}

export async function askedThisSession() {
  const session = await getCurrentSession()
  const rows = await responses.bySession(session.id)
  return new Set(rows.map((row) => row.questionId))
}
