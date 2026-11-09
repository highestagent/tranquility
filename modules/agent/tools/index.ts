import { restSession } from "./rest-session"
import { presentInteraction } from "./present-interaction"
import { rememberPreference } from "./remember-preference"
import { analyzePerformance } from "./analyze-performance"
import { evaluateEvidence } from "./evaluate-evidence"
import { getMeasurements } from "./get-measurements"
import { getUserContext } from "./get-user-context"
import { manageHypotheses } from "./manage-hypotheses"
import { planInvestigation } from "./plan-investigation"
import { saveInvestigation } from "./save-investigation"
import { selectAssessment } from "./select-assessment"
import { selectQuestions } from "./select-questions"

export const investigationTools = {
  presentInteraction,
  restSession,
  getUserContext,
  getMeasurements,
  analyzePerformance,
  manageHypotheses,
  selectQuestions,
  selectAssessment,
  planInvestigation,
  evaluateEvidence,
  saveInvestigation,
  rememberPreference,
}

export type InvestigationTools = typeof investigationTools
export type InvestigationToolName = keyof InvestigationTools
