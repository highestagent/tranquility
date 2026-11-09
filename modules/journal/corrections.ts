import { recordWithdrawals } from "@/modules/agent-memory/withdrawals"
import { analyzeRelationship, scanRelationships } from "@/modules/analytics"
import { ASSESSMENTS } from "@/modules/assessments"
import { getDb } from "@/modules/memory/db"
import { kv, type MetricRef } from "@/modules/memory"
import {
  getQuestion,
  QUESTION_IDS,
  validateAnswer,
} from "@/modules/questionnaire/bank"
const KEY = "pendingRecalculation"
type Pair = { factorId: string; metric: MetricRef }
let rebuilding: Promise<void> | null = null
export function resumeRecalculation() {
  rebuilding ??= (async () => {
    const pairs = await kv.get<Pair[]>(KEY)
    if (!pairs) return
    // Re-run the whole search family to retain multiple-comparison correction.
    await scanRelationships(
      QUESTION_IDS,
      ASSESSMENTS.map((a) => ({
        assessmentId: a.id,
        metricId: a.primaryMetricId,
      })),
      Infinity
    )
    for (const pair of pairs)
      await analyzeRelationship(pair.factorId, pair.metric)
    await kv.remove(KEY)
  })().finally(() => {
    rebuilding = null
  })
  return rebuilding
}

/** Answers are editable; measured trials and scores are never part of this transaction. */
export async function correctAnswer(id: string, value: number | null) {
  await resumeRecalculation()
  const db = await getDb()
  const tx = db.transaction(
    [
      "responses",
      "analyses",
      "discoveries",
      "hypotheses",
      "investigations",
      "decisions",
      "kv",
    ],
    "readwrite"
  )
  const row = await tx.objectStore("responses").get(id)
  const question = row ? getQuestion(row.questionId) : undefined
  if (
    !row ||
    !question ||
    (value !== null && validateAnswer(question, value) !== null)
  ) {
    tx.abort()
    throw new Error("Invalid contextual answer")
  }
  const at = Date.now()
  await tx.objectStore("responses").put({ ...row, value }) // Preserve the observation time.
  const previous = await tx.objectStore("analyses").getAll()
  // A corrected factor can change family-wide adjusted p-values, so all derived findings need review.
  const findings = await tx.objectStore("discoveries").getAll()
  await tx.objectStore("kv").put({
    key: `correction:${id}:${at}`,
    value: { before: row, after: value, at, withdrawnFindings: findings },
  })
  // Every device that saw these findings has to stop presenting them.
  await recordWithdrawals(
    tx.objectStore("kv"),
    findings.map(({ id }) => id),
    at,
    `${question.label} was corrected.`
  )
  const pairs = previous.map((a) => ({
    factorId: a.factorId,
    metric: a.metric,
  }))
  await tx.objectStore("kv").put({ key: KEY, value: pairs })
  await tx.objectStore("analyses").clear()
  await tx.objectStore("discoveries").clear()
  for (const h of await tx.objectStore("hypotheses").getAll()) {
    if (h.status !== "rejected")
      await tx.objectStore("hypotheses").put({
        ...h,
        status: "testing",
        updatedAt: at,
        history: [
          ...h.history,
          {
            at,
            status: "testing",
            note: "Context corrected; previous conclusions withdrawn pending evaluation.",
          },
        ],
      })
  }
  for (const i of await tx.objectStore("investigations").getAll())
    await tx.objectStore("investigations").put({
      ...i,
      status: "active",
      updatedAt: at,
      progressNote:
        "Context corrected. Re-evaluate the updated analyses before reporting a finding.",
    })
  await tx.objectStore("decisions").put({
    id: `correction:${id}:${at}`,
    sessionId: row.sessionId,
    at,
    action: "correctContext",
    reason: `Corrected ${question.label}. Previous findings withdrawn; deterministic analyses will be recalculated.`,
  })
  await tx.objectStore("kv").delete("agentRest")
  await tx.done
  await resumeRecalculation()
}
