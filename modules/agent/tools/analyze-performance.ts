import { tool } from "ai"
import { z } from "zod"

import {
  analyzeRelationship,
  scanRelationships,
  summarizeMetric,
} from "@/modules/analytics"
import { ASSESSMENTS, getAssessment } from "@/modules/assessments"
import type { Analysis } from "@/modules/memory"

import {
  assessmentIdSchema,
  describeEffect,
  questionIdSchema,
  reasonSchema,
  requireField,
  requireMetric,
  roundNumbers,
} from "./shared"
import { QUESTION_IDS } from "@/modules/questionnaire"

function present(analysis: Analysis) {
  return {
    analysisId: analysis.id,
    factorId: analysis.factorId,
    metric: analysis.metric,
    method: analysis.method,
    n: analysis.n,
    effect: analysis.effect,
    ciLow: analysis.ciLow,
    ciHigh: analysis.ciHigh,
    pValue: analysis.pValue,
    grade: analysis.grade,
    direction: analysis.direction,
    meaning: describeEffect(
      analysis.metric.assessmentId,
      analysis.metric.metricId,
      analysis
    ),
    notes: analysis.notes,
  }
}

/** Takes only IDs: all numbers are read from storage by the analytics engine. */
export const analyzePerformance = tool({
  description: `Run deterministic statistics on stored data. Modes:
- "scan": test every factor against each assessment's main metric, to find relationships worth investigating.
- "relationship": test one factor against one metric. Needs factorId, assessmentId and metricId.
- "baseline": compare the latest result with personal baseline. Needs assessmentId and metricId.
Each relationship keeps one analysis per state of the data, so re-running on unchanged data returns the same analysisId.`,
  inputSchema: z.object({
    reason: reasonSchema,
    mode: z.enum(["scan", "relationship", "baseline"]),
    factorId: questionIdSchema.optional(),
    assessmentId: assessmentIdSchema.optional(),
    metricId: z.string().optional(),
  }),
  execute: async ({ mode, factorId, assessmentId, metricId }) => {
    if (mode === "scan") {
      const { tested, findings } = await scanRelationships(
        QUESTION_IDS,
        ASSESSMENTS.map(({ id, primaryMetricId }) => ({
          assessmentId: id,
          metricId: primaryMetricId,
        }))
      )
      return roundNumbers({ mode, tested, findings: findings.map(present) })
    }

    const assessment = requireField(assessmentId, "assessmentId")
    const metric = requireField(metricId, "metricId")
    requireMetric(assessment, metric)
    const ref = { assessmentId: assessment, metricId: metric }

    if (mode === "baseline") {
      const summary = await summarizeMetric(ref)
      return roundNumbers({
        mode,
        ...summary,
        higherIsBetter: getAssessment(assessment)!.metrics.find(
          ({ id }) => id === metric
        )!.higherIsBetter,
      })
    }

    const analysis = await analyzeRelationship(
      requireField(factorId, "factorId"),
      ref
    )
    return roundNumbers({ mode, ...present(analysis) })
  },
})
