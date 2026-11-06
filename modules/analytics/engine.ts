import {
  analyses,
  measurements,
  newId,
  responses,
  type Analysis,
  type MetricRef,
} from "@/modules/memory"

import { computeBaseline, robustZ } from "./baseline"
import { directionOf, gradeRelationship, THRESHOLDS } from "./grading"
import { pairObservations, type Observation } from "./pairing"
import { benjaminiHochberg, testRelationship } from "./relationships"

async function observationsFor(factorId: string, metric: MetricRef) {
  const [runs, answers] = await Promise.all([
    measurements.byAssessment(metric.assessmentId),
    responses.byQuestion(factorId),
  ])
  return pairObservations(runs, answers, metric.metricId)
}

/** Stable seed, so re-running on the same data gives the same answer. */
function seedFor(factorId: string, metric: MetricRef, n: number) {
  let hash = n
  for (const char of `${factorId}|${metric.assessmentId}|${metric.metricId}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  }
  return hash
}

function buildAnalysis(
  factorId: string,
  metric: MetricRef,
  observations: Observation[],
  adjustedP?: number
): Analysis {
  const base = {
    id: newId(),
    createdAt: Date.now(),
    factorId,
    metric,
    n: observations.length,
    measurementIds: observations.flatMap((o) => o.measurementIds),
  }
  const insufficient = (note: string): Analysis => ({
    ...base,
    method: "none",
    effect: null,
    ciLow: null,
    ciHigh: null,
    pValue: null,
    direction: "none",
    grade: "insufficient",
    notes: [note],
  })

  if (observations.length < THRESHOLDS.minPairs) {
    return insufficient(
      `Only ${observations.length} of ${THRESHOLDS.minPairs} needed sessions have both this answer and a valid result.`
    )
  }
  const distinct = new Set(observations.map((o) => o.x))
  if (distinct.size < 2) {
    return insufficient("This answer has never varied, so it can't be tested.")
  }
  if ([...distinct].every((value) => value === 0 || value === 1)) {
    const yes = observations.filter((o) => o.x === 1).length
    const smallest = Math.min(yes, observations.length - yes)
    if (smallest < THRESHOLDS.minGroupSize) {
      return insufficient(
        `Each answer needs at least ${THRESHOLDS.minGroupSize} sessions, and the rarer one has ${smallest}.`
      )
    }
  }

  const result = testRelationship(
    observations,
    seedFor(factorId, metric, observations.length)
  )
  if (!result) return insufficient("The results have no variation to compare.")

  const notes = ["Adjusted for trends over time, such as practice effects."]
  if (adjustedP !== undefined) {
    notes.push("The p-value is corrected for testing many relationships.")
  }
  const pValue = adjustedP ?? result.pValue
  return {
    ...base,
    method: result.method,
    effect: result.effect,
    ciLow: result.ciLow,
    ciHigh: result.ciHigh,
    pValue,
    direction: directionOf(result.effect),
    grade: gradeRelationship(result, pValue),
    notes,
  }
}

/** Runs and stores one analysis. Inputs are IDs, never numbers. */
export async function analyzeRelationship(
  factorId: string,
  metric: MetricRef
): Promise<Analysis> {
  const observations = await observationsFor(factorId, metric)
  return analyses.put(buildAnalysis(factorId, metric, observations))
}

/**
 * Tests every factor against every metric and stores what stands out. p-values
 * are corrected, since testing many pairs will find chance patterns otherwise.
 */
export async function scanRelationships(
  factorIds: readonly string[],
  metrics: readonly MetricRef[],
  limit = 3
): Promise<{ tested: number; findings: Analysis[] }> {
  const pairs = factorIds.flatMap((factorId) =>
    metrics.map((metric) => ({ factorId, metric }))
  )
  const raw = await Promise.all(
    pairs.map(async (pair) => {
      const observations = await observationsFor(pair.factorId, pair.metric)
      const analysis = buildAnalysis(pair.factorId, pair.metric, observations)
      return { ...pair, observations, analysis }
    })
  )
  const tested = raw.filter(({ analysis }) => analysis.pValue !== null)
  const adjusted = benjaminiHochberg(tested.map((t) => t.analysis.pValue!))

  const corrected = tested.map(({ factorId, metric, observations }, index) =>
    buildAnalysis(factorId, metric, observations, adjusted[index])
  )
  const findings = corrected
    .filter(({ direction }) => direction !== "none")
    .sort((a, b) => a.pValue! - b.pValue!)
    .slice(0, limit)
  await Promise.all(findings.map((finding) => analyses.put(finding)))
  return { tested: tested.length, findings }
}

export interface MetricSummary {
  metric: MetricRef
  baseline: ReturnType<typeof computeBaseline>
  latest: number | null
  /** Latest result's distance from baseline, in robust standard deviations. */
  latestZ: number | null
}

/** Compares the latest valid run with the runs before it. */
export async function summarizeMetric(metric: MetricRef): Promise<MetricSummary> {
  const runs = await measurements.byAssessment(metric.assessmentId)
  const values = runs
    .filter((run) => run.valid)
    .flatMap((run) => run.metrics[metric.metricId] ?? [])
  const latest = values.at(-1) ?? null
  const baseline = computeBaseline(values.slice(0, -1))
  return {
    metric,
    baseline,
    latest,
    latestZ:
      latest !== null && baseline ? robustZ(latest, baseline) : null,
  }
}

/** How many usable sessions exist for a factor and metric. */
export async function countPairs(factorId: string, metric: MetricRef) {
  return (await observationsFor(factorId, metric)).length
}
