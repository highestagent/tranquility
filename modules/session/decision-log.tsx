import { History } from "lucide-react"

import { Sheet } from "@/components/sheet"
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
    <Sheet label="What I did" Icon={History} title="What I did">
      <ol className="flex flex-col gap-3 text-sm">
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
    </Sheet>
  )
}
