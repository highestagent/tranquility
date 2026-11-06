import { tool } from "ai"
import { z } from "zod"

import {
  askedThisSession,
  resolveQuestions,
} from "@/modules/questionnaire"

import { getPendingTask, setPendingTask } from "../pending-task"
import { questionIdSchema, reasonSchema } from "./shared"

export const selectQuestions = tool({
  description:
    "Ask the user questions. This ends your turn until they answer or decline. Your reason is shown to them.",
  inputSchema: z.object({
    reason: reasonSchema,
    questionIds: z.array(questionIdSchema).min(1).max(8),
    investigationId: z.string().optional(),
  }),
  execute: async ({ reason, questionIds, investigationId }) => {
    if (await getPendingTask()) {
      throw new Error("The user already has a pending task. End your turn.")
    }
    const resolved = resolveQuestions(questionIds, await askedThisSession())
    if (resolved.length === 0) {
      return {
        status: "nothing-to-ask" as const,
        note: "All of these were already asked this session. Choose something else.",
      }
    }
    await setPendingTask({
      kind: "questions",
      questionIds: resolved,
      reason,
      investigationId,
    })
    return { status: "awaiting-user" as const, questionIds: resolved }
  },
})
