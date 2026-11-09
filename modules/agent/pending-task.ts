import type { Interaction } from "@/modules/interaction/catalog"
import { kv, newId, getCurrentSession } from "@/modules/memory"
import type { QuestionId } from "@/modules/questionnaire"

const KEY = "pendingTask"

interface BaseTask {
  id: string
  reason: string
  sessionId?: string
  investigationId?: string
}

export type PendingTask =
  | (BaseTask & { kind: "questions"; questionIds: QuestionId[] })
  | (BaseTask & {
      kind: "interaction"
      message: string
      interaction: Interaction
    })
  | (BaseTask & { kind: "assessment"; assessmentId: string })

type NewTask =
  | Omit<Extract<PendingTask, { kind: "interaction" }>, "id">
  | Omit<Extract<PendingTask, { kind: "questions" }>, "id">
  | Omit<Extract<PendingTask, { kind: "assessment" }>, "id">

/** What the agent is waiting on. Stored, so it survives closing the browser. */
export async function getPendingTask() {
  return (await kv.get<PendingTask>(KEY)) ?? null
}

export async function setPendingTask(task: NewTask) {
  const session = await getCurrentSession()
  const pending = { ...task, sessionId: session.id, id: newId() } as PendingTask
  await kv.set(KEY, pending)
  return pending
}

export async function clearPendingTask() {
  await kv.remove(KEY)
}
