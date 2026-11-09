import { latestAnalysisFor } from "@/modules/analytics"
import {
  analyses,
  discoveries,
  hypotheses,
  investigations,
  newId,
  type Analysis,
  type Discovery,
  type EvidenceRequirement,
  type Hypothesis,
  type HypothesisStatus,
  type Investigation,
  type MetricRef,
} from "@/modules/memory"

import { decideVerdict } from "./verdict"

export async function createInvestigation(input: {
  title: string
  question: string
  origin: Investigation["origin"]
  objectives: string[]
  evidenceRequirements: EvidenceRequirement[]
}) {
  const existing = (await investigations.list()).find(
    (row) =>
      row.status !== "completed" &&
      row.question === input.question &&
      row.origin === input.origin
  )
  if (existing) return existing
  const now = Date.now()
  return investigations.put({
    ...input,
    id: newId(),
    status: "active",
    progressNote: "",
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateInvestigation(
  id: string,
  changes: Partial<
    Pick<
      Investigation,
      | "status"
      | "progressNote"
      | "objectives"
      | "evidenceRequirements"
      | "nextStep"
      | "nextMeasurementAt"
    >
  >
) {
  const existing = await investigations.get(id)
  if (!existing) throw new Error(`Unknown investigation: ${id}`)
  return investigations.put({ ...existing, ...changes, updatedAt: Date.now() })
}

export async function addHypothesis(input: {
  investigationId: string
  statement: string
  factorId: string
  metric: MetricRef
  expectedDirection: Hypothesis["expectedDirection"]
  rationale: string
}) {
  if (!(await investigations.get(input.investigationId))) {
    throw new Error(`Unknown investigation: ${input.investigationId}`)
  }
  const existing = (
    await hypotheses.byInvestigation(input.investigationId)
  ).find(
    (row) =>
      row.statement === input.statement &&
      row.factorId === input.factorId &&
      row.metric.assessmentId === input.metric.assessmentId &&
      row.metric.metricId === input.metric.metricId
  )
  if (existing) return existing
  const now = Date.now()
  return hypotheses.put({
    ...input,
    id: newId(),
    status: "proposed",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, status: "proposed", note: input.rationale }],
  })
}

async function transition(
  id: string,
  status: HypothesisStatus,
  note: string
): Promise<Hypothesis> {
  const existing = await hypotheses.get(id)
  if (!existing) throw new Error(`Unknown hypothesis: ${id}`)
  if (existing.status === "rejected") {
    throw new Error("A rejected hypothesis can't change. Create a new one.")
  }
  const at = Date.now()
  return hypotheses.put({
    ...existing,
    status,
    updatedAt: at,
    history: [...existing.history, { at, status, note }],
  })
}

/** Verdict statuses are only reachable through `evaluateHypothesis`. */
export function startTesting(id: string, note: string) {
  return transition(id, "testing", note)
}

export function rejectHypothesis(id: string, note: string) {
  return transition(id, "rejected", note)
}

function describeEvidence(analysis: Analysis) {
  if (analysis.effect === null) {
    return `${analysis.n} comparable sessions so far. ${analysis.notes.join(" ")}`
  }
  const name =
    analysis.method === "spearman" ? "correlation" : "group difference"
  const p =
    analysis.pValue === null
      ? ""
      : analysis.pValue < 0.001
        ? ", p < 0.001"
        : `, p = ${analysis.pValue.toFixed(3)}`
  const interval =
    analysis.ciLow !== null && analysis.ciHigh !== null
      ? ` (95% interval ${analysis.ciLow.toFixed(2)} to ${analysis.ciHigh.toFixed(2)})`
      : ""
  return `${analysis.n} comparable sessions: ${name} of ${analysis.effect.toFixed(2)}${interval}${p}. ${analysis.notes.join(" ")}`
}

const RELIABILITY: Record<Analysis["grade"], string> = {
  insufficient: "Not enough data yet to say anything reliable.",
  weak: "Weak evidence. This could easily be chance.",
  moderate:
    "Moderate evidence. The pattern is unlikely to be chance, but it could still change with more data.",
  strong: "Strong evidence, within your own data.",
  contradictory:
    "Contradictory evidence. The pattern reversed between earlier and later sessions.",
}

/**
 * Records a finding. The verdict, evidence, and reliability come from stored
 * analyses. The agent supplies only the plain-language framing.
 */
export async function evaluateHypothesis(input: {
  hypothesisId: string
  analysisIds: string[]
  observed: string
  uncertainty: string
  nextStep: string
}): Promise<Discovery> {
  const hypothesis = await hypotheses.get(input.hypothesisId)
  if (!hypothesis) throw new Error(`Unknown hypothesis: ${input.hypothesisId}`)

  const cited = await Promise.all(
    input.analysisIds.map(async (id) => {
      const analysis = await analyses.get(id)
      if (!analysis) throw new Error(`Unknown analysis: ${id}`)
      return analysis
    })
  )
  const relevant = cited.filter(
    (analysis) =>
      analysis.factorId === hypothesis.factorId &&
      analysis.metric.assessmentId === hypothesis.metric.assessmentId &&
      analysis.metric.metricId === hypothesis.metric.metricId
  )
  if (relevant.length === 0) {
    throw new Error(
      "None of these analyses test this hypothesis's factor and metric."
    )
  }
  // Judged on the current analysis, so an older result can't be cherry-picked.
  const latest = (await latestAnalysisFor(
    hypothesis.factorId,
    hypothesis.metric
  ))!

  // "Too little data" is a fair finding. "No data at all" is not a finding yet.
  if (latest.n === 0) {
    throw new Error(
      "There's no data for this relationship yet. Collect some before recording a finding."
    )
  }

  const previous = (
    await discoveries.byInvestigation(hypothesis.investigationId)
  ).find(
    (row) =>
      row.hypothesisId === hypothesis.id && row.analysisIds.includes(latest.id)
  )
  if (previous) return previous
  const verdict = decideVerdict(hypothesis.expectedDirection, latest)
  const discovery = await discoveries.put({
    id: newId(),
    investigationId: hypothesis.investigationId,
    hypothesisId: hypothesis.id,
    analysisIds: [...new Set([...relevant.map(({ id }) => id), latest.id])],
    grade: latest.grade,
    verdict,
    observed: input.observed,
    evidence: describeEvidence(latest),
    reliability: RELIABILITY[latest.grade],
    uncertainty: input.uncertainty,
    nextStep: input.nextStep,
    createdAt: Date.now(),
  })
  await transition(
    hypothesis.id,
    verdict,
    `Evaluated against analysis ${latest.id}: ${latest.grade} evidence.`
  )
  return discovery
}
