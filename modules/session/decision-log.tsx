"use client"

import type { Decision } from "@/modules/memory"

const ACTION_LABELS: Record<string, string> = {
  getUserContext: "Reviewed your history",
  getMeasurements: "Looked at results",
  analyzePerformance: "Ran statistics",
  manageHypotheses: "Updated a hypothesis",
  selectQuestions: "Chose questions",
  selectAssessment: "Chose a game",
  planInvestigation: "Planned an investigation",
  evaluateEvidence: "Evaluated evidence",
  saveInvestigation: "Saved progress",
}

export function DecisionLog({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return null
  return (
    <details className="border-t border-border pt-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        What the agent did and why
      </summary>
      <ol className="mt-3 flex flex-col gap-2">
        {decisions.map((decision) => (
          <li key={decision.id} className="flex flex-col">
            <span className="font-medium">
              {ACTION_LABELS[decision.action] ?? decision.action}
            </span>
            <span className="text-muted-foreground">{decision.reason}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}
