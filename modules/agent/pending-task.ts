import type { Interaction } from "@/modules/interaction/catalog"
import { kv, newId, getCurrentSession } from "@/modules/memory"
import { SESSION_WINDOW_MS } from "@/modules/memory/current-session"
import type { QuestionId } from "@/modules/questionnaire"

const KEY = "pendingTask"

interface BaseTask {
  id: string
  createdAt: number
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
  | Omit<Extract<PendingTask, { kind: "interaction" }>, "id" | "createdAt">
  | Omit<Extract<PendingTask, { kind: "questions" }>, "id" | "createdAt">
  | Omit<Extract<PendingTask, { kind: "assessment" }>, "id" | "createdAt">

function startOfDay(at: number) {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * A task belongs to the session it was asked in. Once that session is over, or
 * the day has turned, "how did you sleep last night?" means something else.
 */
export function isStale(task: Pick<PendingTask, "createdAt">, now: number) {
  return (
    !task.createdAt ||
    now - task.createdAt >= SESSION_WINDOW_MS ||
    startOfDay(task.createdAt) !== startOfDay(now)
  )
}

/**
 * What the agent is waiting on. Stored, so it survives closing the browser,
 * but a stale one is dropped so the agent plans afresh.
 */
export async function getPendingTask(now = Date.now()) {
  const task = (await kv.get<PendingTask>(KEY)) ?? null
  if (task && isStale(task, now)) {
    await kv.remove(KEY)
    return null
  }
  return task
}

/** Drops a stale task. True if there was one. */
export async function expireStaleTask(now = Date.now()) {
  const task = await kv.get<PendingTask>(KEY)
  if (!task || !isStale(task, now)) return false
  await kv.remove(KEY)
  return true
}

export async function setPendingTask(task: NewTask) {
  const session = await getCurrentSession()
  const pending = {
    ...task,
    sessionId: session.id,
    id: newId(),
    createdAt: Date.now(),
  } as PendingTask
  await kv.set(KEY, pending)
  return pending
}

export async function clearPendingTask() {
  await kv.remove(KEY)
}
