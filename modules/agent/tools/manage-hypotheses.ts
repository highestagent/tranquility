import { tool } from "ai"
import { z } from "zod"

import {
  addHypothesis,
  rejectHypothesis,
  startTesting,
} from "@/modules/investigation"

import {
  assessmentIdSchema,
  questionIdSchema,
  reasonSchema,
  requireField,
  requireMetric,
} from "./shared"

export const manageHypotheses = tool({
  description: `Create or revise a hypothesis. Verdicts come only from evaluateEvidence.
- "create": needs investigationId, statement, factorId, assessmentId, metricId, expectedDirection.
- "start-testing": marks a hypothesis as being tested while evidence is collected. Needs hypothesisId. It's optional, because evaluateEvidence works from any status except rejected.
- "reject": needs hypothesisId.
expectedDirection is the raw direction of the metric as the answer rises. Lower reaction time is a "negative" direction.`,
  inputSchema: z.object({
    reason: reasonSchema,
    action: z.enum(["create", "start-testing", "reject"]),
    hypothesisId: z.string().optional(),
    investigationId: z.string().optional(),
    statement: z.string().max(200).optional(),
    factorId: questionIdSchema.optional(),
    assessmentId: assessmentIdSchema.optional(),
    metricId: z.string().optional(),
    expectedDirection: z.enum(["positive", "negative", "any"]).optional(),
  }),
  execute: async (input) => {
    if (input.action === "create") {
      const assessmentId = requireField(input.assessmentId, "assessmentId")
      const metricId = requireField(input.metricId, "metricId")
      requireMetric(assessmentId, metricId)
      const hypothesis = await addHypothesis({
        investigationId: requireField(input.investigationId, "investigationId"),
        statement: requireField(input.statement, "statement"),
        factorId: requireField(input.factorId, "factorId"),
        metric: { assessmentId, metricId },
        expectedDirection: requireField(
          input.expectedDirection,
          "expectedDirection"
        ),
        rationale: input.reason,
      })
      return { hypothesisId: hypothesis.id, status: hypothesis.status }
    }

    const id = requireField(input.hypothesisId, "hypothesisId")
    const hypothesis =
      input.action === "reject"
        ? await rejectHypothesis(id, input.reason)
        : await startTesting(id, input.reason)
    return { hypothesisId: hypothesis.id, status: hypothesis.status }
  },
})
