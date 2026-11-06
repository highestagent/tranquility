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
  return views.sort((a, b) => b.discovery.createdAt - a.discovery.createdAt)
}
