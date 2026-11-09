import { nextMeasurementAt } from "@/modules/assessments/interval"
import { tool } from "ai"
import { z } from "zod"

import { getPendingTask, setPendingTask } from "../pending-task"
import { assessmentIdSchema, reasonSchema } from "./shared"

/** Takes only an ID, so protocols can't be altered from here. */
export const selectAssessment = tool({
  description:
    "Recommend the next cognitive game. This ends your turn until they finish or decline. Your reason is shown to them.",
  inputSchema: z.object({
    reason: reasonSchema,
    assessmentId: assessmentIdSchema,
    investigationId: z.string().optional(),
  }),
  execute: async ({ reason, assessmentId, investigationId }) => {
    if (await getPendingTask()) {
      throw new Error("The user already has a pending task. End your turn.")
    }
    const nextAt = await nextMeasurementAt(assessmentId)
    if (nextAt > Date.now())
      return {
        status: "rest",
        nextAt,
        note: "This measurement was taken recently. Rest or choose a different useful activity.",
      }
    await setPendingTask({
      kind: "assessment",
      assessmentId,
      reason,
      investigationId,
    })
    return { status: "awaiting-user" as const, assessmentId }
  },
})
