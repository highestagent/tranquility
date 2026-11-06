import { getCurrentSession, newId, responses } from "@/modules/memory"

import { BANK_VERSION, type QuestionId } from "./bank"

/** Stores answers; `null` records a declined question. */
export async function saveAnswers(
  answers: Partial<Record<QuestionId, number | null>>
) {
  const session = await getCurrentSession()
  const answeredAt = Date.now()
  await Promise.all(
    Object.entries(answers).map(([questionId, value]) =>
      responses.put({
        id: newId(),
        sessionId: session.id,
        questionId,
        bankVersion: BANK_VERSION,
        value: value ?? null,
        answeredAt,
      })
    )
  )
}

export async function askedThisSession() {
  const session = await getCurrentSession()
  const rows = await responses.bySession(session.id)
  return new Set(rows.map((row) => row.questionId))
}
