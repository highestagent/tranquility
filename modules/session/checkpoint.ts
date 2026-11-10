import { getDb } from "@/modules/memory/db"
import { discoveries, getCurrentSession, kv } from "@/modules/memory"

import { markDiscoverySeen } from "./wake"
import {
  isDisplayOnly,
  validAnswer,
  type Answer,
} from "@/modules/interaction/catalog"
import type { PendingTask } from "@/modules/agent/pending-task"
export const CONTINUATION_KEY = "sessionContinuation"

/** What the agent was last sent, and when, so a reload can carry it on. */
export interface Continuation {
  text: string
  at: number
}
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
  // Continuing past a finding or chart isn't an answer, so it isn't recorded as one.
  if (task.kind === "interaction" && !isDisplayOnly(task.interaction)) {
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
  await tx.store.put({
    key: CONTINUATION_KEY,
    value: { text, at: Date.now() } satisfies Continuation,
  })
  await tx.store.delete("pendingTask")
  await tx.done
  if (task.kind === "interaction" && task.interaction.type === "EvidenceCard") {
    const shown = await discoveries.get(task.interaction.props.discoveryId)
    if (shown) await markDiscoverySeen(shown.createdAt)
  }
}
export function setContinuation(text: string) {
  return kv.set(CONTINUATION_KEY, {
    text,
    at: Date.now(),
  } satisfies Continuation)
}
export async function getContinuation() {
  return kv.get<Continuation>(CONTINUATION_KEY)
}

/**
 * The cut-off turn to carry on after a reload, if any. A question asked while
 * a task was showing is newer than the task, so it's answered rather than lost
 * behind it. A task newer than the turn is that turn's result, so it shows.
 */
export function unansweredContinuation(
  continuation: Continuation | undefined,
  pending: Pick<PendingTask, "createdAt"> | null
) {
  if (!continuation) return null
  if (pending && continuation.at <= pending.createdAt) return null
  return continuation
}
