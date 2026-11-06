import { tool } from "ai"
import { z } from "zod"

import { updateInvestigation } from "@/modules/investigation"

import { reasonSchema } from "./shared"

export const saveInvestigation = tool({
  description:
    "Save a progress note for your future self, and optionally change the investigation's status. Save before ending a turn.",
  inputSchema: z.object({
    reason: reasonSchema,
    investigationId: z.string(),
    progressNote: z
      .string()
      .max(500)
      .describe("What was learned and what evidence to collect next."),
    status: z.enum(["active", "completed"]).optional(),
  }),
  execute: async ({ investigationId, progressNote, status }) => {
    const investigation = await updateInvestigation(investigationId, {
      progressNote,
      ...(status ? { status } : {}),
    })
    return { investigationId: investigation.id, status: investigation.status }
  },
})
