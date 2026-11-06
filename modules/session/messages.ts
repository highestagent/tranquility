import type { PendingTask } from "@/modules/agent/pending-task"

/**
 * Turns the app sends on the user's behalf. These carry IDs and counts only:
 * the agent reads actual values through its tools, which limits what is sent.
 */
export const SESSION_START =
  "The user opened a session. Review the current state and decide the most useful next step."

export const CONTINUE =
  "The user wants to continue. Review the current state and decide the most useful next step."

export function questionsFinished(answered: number, total: number) {
  return answered === 0
    ? `The user declined all ${total} questions. Don't ask them again this session.`
    : `The user answered ${answered} of ${total} questions. Anything else was declined.`
}

export function assessmentFinished(
  task: Extract<PendingTask, { kind: "assessment" }>,
  measurementId: string
) {
  return `The user finished ${task.assessmentId}. Measurement ID: ${measurementId}.`
}

export function assessmentDeclined(
  task: Extract<PendingTask, { kind: "assessment" }>
) {
  return `The user declined or didn't finish ${task.assessmentId}. Don't press them. Choose something else or stop for today.`
}
