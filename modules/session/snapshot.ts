import { resumeRecalculation } from "@/modules/journal/corrections"
import { expireStaleTask, getPendingTask } from "@/modules/agent/pending-task"
import { loadResumePoint } from "@/modules/agent-memory/resume"
import { discoveries, measurements, responses } from "@/modules/memory"

import { getAgentRest, getSeenDiscoveriesAt } from "./wake"

/** Everything the home screen shows, restored from this device. */
export async function loadSnapshot() {
  await resumeRecalculation()
  // An old question would be answered for a session that's already over.
  const taskExpired = await expireStaleTask()
  const [pending, rest, findings, seenAt, runs, answers, resume] =
    await Promise.all([
      getPendingTask(),
      getAgentRest(),
      discoveries.list(),
      getSeenDiscoveriesAt(),
      measurements.list(),
      responses.list(),
      loadResumePoint(),
    ])
  // A finding the agent is showing right now would otherwise be shown twice.
  const presented =
    pending?.kind === "interaction" &&
    pending.interaction.type === "EvidenceCard"
      ? pending.interaction.props.discoveryId
      : null
  const unseen = findings
    .filter((finding) => finding.createdAt > seenAt && finding.id !== presented)
    .sort((a, b) => a.createdAt - b.createdAt)

  return {
    pending,
    taskExpired,
    rest,
    resume,
    unseen,
    latestDataAt: Math.max(
      0,
      ...runs.map((run) => run.completedAt),
      ...answers.flatMap((answer) =>
        answer.value === null ? [] : [answer.answeredAt]
      )
    ),
  }
}

export type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>
