import type { InvestigationToolName } from "./tools"

const READ: InvestigationToolName[] = ["getUserContext", "getMeasurements"]

const INVESTIGATE: InvestigationToolName[] = [
  ...READ,
  "analyzePerformance",
  "manageHypotheses",
  "planInvestigation",
  "selectQuestions",
  "presentInteraction",
  "restSession",
  "selectAssessment",
  "saveInvestigation",
]

export type Stage = "understand" | "investigate" | "evaluate"

/**
 * Permissions follow the investigation cycle. The agent must read before it
 * acts, and can only record a finding after analyzing data in the same turn.
 */
export function stageFor(toolsCalled: readonly string[]): Stage {
  if (
    !toolsCalled.some((name) => READ.includes(name as InvestigationToolName))
  ) {
    return "understand"
  }
  return toolsCalled.includes("analyzePerformance") ? "evaluate" : "investigate"
}

export function activeToolsFor(stage: Stage): InvestigationToolName[] {
  switch (stage) {
    case "understand":
      return READ
    case "investigate":
      return INVESTIGATE
    case "evaluate":
      return [...INVESTIGATE, "evaluateEvidence"]
  }
}
