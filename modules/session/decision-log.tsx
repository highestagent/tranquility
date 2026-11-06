import { History } from "lucide-react"

import { STAGE_ICONS, type Stage } from "@/modules/insights/agent-pool"
import type { Decision } from "@/modules/memory"

const ACTION_STAGES: Record<string, Stage> = {
  getUserContext: "understand",
  getMeasurements: "understand",
  selectQuestions: "question",
  selectAssessment: "assess",
  analyzePerformance: "analyze",
  manageHypotheses: "reason",
  evaluateEvidence: "reason",
  planInvestigation: "adapt",
  saveInvestigation: "adapt",
}

/** Why the agent did what it did, so its autonomy can always be checked. */
export function DecisionLog({ decisions }: { decisions: readonly Decision[] }) {
  if (decisions.length === 0) return null
  return (
    <details className="text-sm">
      <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <History aria-hidden className="size-3.5" />
        What I did
      </summary>
      <ol className="mt-3 flex flex-col gap-3">
        {decisions.map((decision) => {
          const Icon =
            STAGE_ICONS[ACTION_STAGES[decision.action] ?? "understand"]
          return (
            <li key={decision.id} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="pt-1 text-muted-foreground">
                {decision.reason}
              </span>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
