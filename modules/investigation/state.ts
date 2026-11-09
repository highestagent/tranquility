import { countPairs } from "@/modules/analytics"
import {
  discoveries,
  hypotheses,
  investigations,
  type Hypothesis,
  type Investigation,
} from "@/modules/memory"

export interface InvestigationSummary {
  id: string
  title: string
  question: string
  status: Investigation["status"]
  progressNote: string
  /** What would help next, and when, as the agent left it at rest. */
  nextStep?: string
  nextMeasurementAt?: number
  objectives: string[]
  evidence: {
    factorId: string
    metric: Hypothesis["metric"]
    have: number
    need: number
  }[]
  hypotheses: {
    id: string
    statement: string
    status: Hypothesis["status"]
    factorId: string
    metric: Hypothesis["metric"]
  }[]
  discoveries: {
    id: string
    verdict: string
    grade: string
    observed: string
  }[]
}

async function summarize(
  investigation: Investigation
): Promise<InvestigationSummary> {
  const [hypothesisRows, discoveryRows, evidence] = await Promise.all([
    hypotheses.byInvestigation(investigation.id),
    discoveries.byInvestigation(investigation.id),
    Promise.all(
      investigation.evidenceRequirements.map(async (requirement) => ({
        factorId: requirement.factorId,
        metric: requirement.metric,
        have: await countPairs(requirement.factorId, requirement.metric),
        need: requirement.minPairs,
      }))
    ),
  ])
  return {
    id: investigation.id,
    title: investigation.title,
    question: investigation.question,
    status: investigation.status,
    progressNote: investigation.progressNote,
    nextStep: investigation.nextStep,
    nextMeasurementAt: investigation.nextMeasurementAt,
    objectives: investigation.objectives,
    evidence,
    hypotheses: hypothesisRows.map((row) => ({
      id: row.id,
      statement: row.statement,
      status: row.status,
      factorId: row.factorId,
      metric: row.metric,
    })),
    discoveries: discoveryRows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        id: row.id,
        verdict: row.verdict,
        grade: row.grade,
        observed: row.observed,
      })),
  }
}

/** Everything needed to resume, compact enough for a model's context. */
export async function getInvestigationState() {
  const rows = await investigations.list()
  const open = rows
    .filter((row) => row.status !== "completed")
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const completed = rows.filter((row) => row.status === "completed")
  return {
    open: await Promise.all(open.map(summarize)),
    completedCount: completed.length,
  }
}

const STATUS_ORDER: Record<Investigation["status"], number> = {
  active: 0,
  paused: 1,
  completed: 2,
}

/** Active work first, and in a stable order so cards don't jump when changed. */
export async function listInvestigationSummaries() {
  const rows = await investigations.list()
  return Promise.all(
    rows
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.createdAt - b.createdAt
      )
      .map(summarize)
  )
}
