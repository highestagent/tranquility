import { tool } from "ai"
import { z } from "zod"

import { summarizeMetric } from "@/modules/analytics"
import { getAssessment } from "@/modules/assessments"
import { measurements } from "@/modules/memory"

import { assessmentIdSchema, reasonSchema } from "./shared"

export const getMeasurements = tool({
  description:
    "Read recent valid results for one assessment, with baselines. Raw trial data is never included.",
  inputSchema: z.object({
    reason: reasonSchema,
    assessmentId: assessmentIdSchema,
    limit: z.number().int().min(1).max(20).optional(),
  }),
  execute: async ({ assessmentId, limit = 10 }) => {
    const assessment = getAssessment(assessmentId)!
    const runs = (await measurements.byAssessment(assessmentId)).filter(
      (run) => run.valid
    )
    const baselines = await Promise.all(
      assessment.metrics.map(async ({ id }) => {
        const summary = await summarizeMetric({ assessmentId, metricId: id })
        return {
          metricId: id,
          baseline: summary.baseline,
          latest: summary.latest,
          latestZ: summary.latestZ,
        }
      })
    )
    return {
      assessmentId,
      totalValidRuns: runs.length,
      recent: runs.slice(-limit).map((run) => ({
        measurementId: run.id,
        sessionId: run.sessionId,
        metrics: run.metrics,
      })),
      baselines,
    }
  },
})
