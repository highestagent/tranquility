import { tool } from "ai"
import { z } from "zod"

import { evaluateHypothesis } from "@/modules/investigation"

import { narrativeSchema, reasonSchema } from "./shared"

/** The verdict and figures are computed. The agent only frames them. */
export const evaluateEvidence = tool({
  description:
    "Record a finding for a hypothesis from stored analyses. The system decides the verdict and adds the figures. Your text must contain no numerals and no medical claims.",
  inputSchema: z.object({
    reason: reasonSchema,
    hypothesisId: z.string(),
    analysisIds: z.array(z.string()).min(1).max(5),
    observed: narrativeSchema.describe("What was observed, in plain language."),
    uncertainty: narrativeSchema.describe("What remains uncertain."),
    nextStep: narrativeSchema.describe("What you propose to look at next."),
  }),
  execute: async ({
    hypothesisId,
    analysisIds,
    observed,
    uncertainty,
    nextStep,
  }) => {
    const discovery = await evaluateHypothesis({
      hypothesisId,
      analysisIds,
      observed,
      uncertainty,
      nextStep,
    })
    return {
      discoveryId: discovery.id,
      verdict: discovery.verdict,
      grade: discovery.grade,
      evidence: discovery.evidence,
      reliability: discovery.reliability,
    }
  },
})
