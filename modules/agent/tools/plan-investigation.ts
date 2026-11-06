import { tool } from "ai"
import { z } from "zod"

import { THRESHOLDS } from "@/modules/analytics"
import { createInvestigation, updateInvestigation } from "@/modules/investigation"

import {
  assessmentIdSchema,
  questionIdSchema,
  reasonSchema,
  requireField,
  requireMetric,
} from "./shared"

const requirementSchema = z.object({
  factorId: questionIdSchema,
  assessmentId: assessmentIdSchema,
  metricId: z.string(),
  minPairs: z
    .number()
    .int()
    .min(THRESHOLDS.minPairs)
    .max(60)
    .describe("Sessions needed with both the answer and a valid result."),
})

function toRequirements(items: z.infer<typeof requirementSchema>[]) {
  return items.map(({ factorId, assessmentId, metricId, minPairs }) => {
    requireMetric(assessmentId, metricId)
    return { factorId, metric: { assessmentId, metricId }, minPairs }
  })
}

export const planInvestigation = tool({
  description: `Define what to investigate and what evidence is needed.
- "create": needs title, question, origin, objectives, evidence.
- "update": needs investigationId, and new objectives or evidence.`,
  inputSchema: z.object({
    reason: reasonSchema,
    action: z.enum(["create", "update"]),
    investigationId: z.string().optional(),
    title: z.string().max(80).optional(),
    question: z.string().max(300).optional(),
    origin: z
      .enum(["agent", "user"])
      .optional()
      .describe('"user" if the user asked this question themselves.'),
    objectives: z.array(z.string().max(160)).max(6).optional(),
    evidence: z.array(requirementSchema).max(6).optional(),
  }),
  execute: async (input) => {
    if (input.action === "create") {
      const investigation = await createInvestigation({
        title: requireField(input.title, "title"),
        question: requireField(input.question, "question"),
        origin: requireField(input.origin, "origin"),
        objectives: requireField(input.objectives, "objectives"),
        evidenceRequirements: toRequirements(
          requireField(input.evidence, "evidence")
        ),
      })
      return { investigationId: investigation.id }
    }
    const investigation = await updateInvestigation(
      requireField(input.investigationId, "investigationId"),
      {
        ...(input.objectives ? { objectives: input.objectives } : {}),
        ...(input.evidence
          ? { evidenceRequirements: toRequirements(input.evidence) }
          : {}),
      }
    )
    return { investigationId: investigation.id }
  },
})
