import { resumeRecalculation } from "@/modules/journal/corrections"
import { getPendingTask } from "@/modules/agent/pending-task"
import {
  loadDiscoveryViews,
  type DiscoveryView,
} from "@/modules/insights/discovery-data"
import { loadKnowledge } from "@/modules/insights/knowledge"
import { getInvestigationState } from "@/modules/investigation"
import { decisions, measurements, responses } from "@/modules/memory"

import { getAgentRest, getSeenDiscoveriesAt } from "./wake"

const LOGGED_DECISIONS = 30

/** Everything the home screen shows, restored from this device. */
export async function loadSnapshot() {
  await resumeRecalculation()
  const [pending, knowledge, state, log, rest, views, seenAt, runs, answers] =
    await Promise.all([
      getPendingTask(),
      loadKnowledge(),
      getInvestigationState(),
      decisions.recent(LOGGED_DECISIONS),
      getAgentRest(),
      loadDiscoveryViews(),
      getSeenDiscoveriesAt(),
      measurements.list(),
      responses.list(),
    ])
  const unseen: DiscoveryView[] = views
    .filter(({ discovery }) => discovery.createdAt > seenAt)
    .sort((a, b) => a.discovery.createdAt - b.discovery.createdAt)

  return {
    pending,
    knowledge,
    open: state.open,
    log,
    rest,
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
