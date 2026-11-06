import { pairObservations } from "@/modules/analytics/pairing"
import { getAssessment } from "@/modules/assessments"
import {
  analyses,
  discoveries,
  hypotheses,
  measurements,
  responses,
  type Analysis,
  type Discovery,
  type Hypothesis,
} from "@/modules/memory"
import { getQuestion } from "@/modules/questionnaire"

export interface DiscoveryView {
  discovery: Discovery
  hypothesis: Hypothesis | undefined
  analysis: Analysis | undefined
  points: { x: number; y: number }[]
}

const VERDICT_ORDER: Record<Discovery["verdict"], number> = {
  supported: 0,
  refuted: 1,
  inconclusive: 2,
}
const GRADE_ORDER: Record<Discovery["grade"], number> = {
  strong: 0,
  moderate: 1,
  contradictory: 2,
  weak: 3,
  insufficient: 4,
}

/** What's most worth reading first: settled findings, then the rest by strength. */
export function byImportance(a: DiscoveryView, b: DiscoveryView) {
  return (
    VERDICT_ORDER[a.discovery.verdict] - VERDICT_ORDER[b.discovery.verdict] ||
    GRADE_ORDER[a.discovery.grade] - GRADE_ORDER[b.discovery.grade] ||
    b.discovery.createdAt - a.discovery.createdAt
  )
}

export async function loadDiscoveryViews(): Promise<DiscoveryView[]> {
  const [discoveryRows, hypothesisRows, analysisRows] = await Promise.all([
    discoveries.list(),
    hypotheses.list(),
    analyses.list(),
  ])
  const views = await Promise.all(
    discoveryRows.map(async (discovery) => {
      const hypothesis = hypothesisRows.find(
        ({ id }) => id === discovery.hypothesisId
      )
      const analysis = analysisRows
        .filter(({ id }) => discovery.analysisIds.includes(id))
        .sort((a, b) => b.createdAt - a.createdAt)[0]
      if (
        !hypothesis ||
        !getQuestion(hypothesis.factorId) ||
        !getAssessment(hypothesis.metric.assessmentId)
      ) {
        return { discovery, hypothesis, analysis, points: [] }
      }
      const [runs, answers] = await Promise.all([
        measurements.byAssessment(hypothesis.metric.assessmentId),
        responses.byQuestion(hypothesis.factorId),
      ])
      const points = pairObservations(
        runs,
        answers,
        hypothesis.metric.metricId
      ).map(({ x, y }) => ({ x, y }))
      return { discovery, hypothesis, analysis, points }
    })
  )
  return views
}
