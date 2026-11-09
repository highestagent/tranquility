import { resumeRecalculation } from "@/modules/journal/corrections"
import { getPendingTask } from "@/modules/agent/pending-task"
import { loadResumePoint } from "@/modules/agent-memory/resume"
import { discoveries, measurements, responses } from "@/modules/memory"

import { getAgentRest, getSeenDiscoveriesAt } from "./wake"

/** Everything the home screen shows, restored from this device. */
export async function loadSnapshot() {
  await resumeRecalculation()
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
  const unseen = findings
    .filter((finding) => finding.createdAt > seenAt)
    .sort((a, b) => a.createdAt - b.createdAt)

  return {
    pending,
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
