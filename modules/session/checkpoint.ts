import { getDb } from "@/modules/memory/db"
import { getCurrentSession, kv } from "@/modules/memory"
import { validAnswer, type Answer } from "@/modules/interaction/catalog"
import type { PendingTask } from "@/modules/agent/pending-task"
export const CONTINUATION_KEY = "sessionContinuation"
export interface ContextAnswer {
  id: string
  sessionId: string
  message: string
  value: Answer
  at: number
}

/** Commit the response and continuation together before releasing a pending UI. */
export async function commitTask(
  task: PendingTask,
  text: string,
  value?: Answer
) {
  if (
    task.kind === "interaction" &&
    !validAnswer(task.interaction, value ?? null)
  )
    throw new Error("Invalid answer")
  const session = await getCurrentSession()
  const db = await getDb()
  const tx = db.transaction("kv", "readwrite")
  const current = (await tx.store.get("pendingTask"))?.value as
    PendingTask | undefined
  if (current?.id !== task.id) {
    await tx.done
    return
  }
  if (task.kind === "interaction") {
    const previous = (await tx.store.get("contextAnswers"))?.value as
      ContextAnswer[] | undefined
    const record: ContextAnswer = {
      id: task.id,
      sessionId: task.sessionId ?? session.id,
      message: task.message,
      value: value ?? null,
      at: Date.now(),
    }
    await tx.store.put({
      key: "contextAnswers",
      value: [...(previous ?? []).filter((r) => r.id !== task.id), record],
    })
  }
  await tx.store.put({ key: CONTINUATION_KEY, value: text })
  await tx.store.delete("pendingTask")
  await tx.done
}
export async function getContinuation() {
  return kv.get<string>(CONTINUATION_KEY)
}
