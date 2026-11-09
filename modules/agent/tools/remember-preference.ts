import { tool } from "ai"
import { z } from "zod"

import { savePreference } from "@/modules/agent-memory/preferences"
import { MAX_PREFERENCE_CHARS } from "@/modules/agent-memory/records"

import { reasonSchema } from "./shared"

export const rememberPreference = tool({
  description:
    "Save something the user explicitly asked you to remember, such as when check-ins suit them. It syncs to their other devices, and they can review or remove it in You.",
  inputSchema: z.object({
    reason: reasonSchema,
    text: z
      .string()
      .min(1)
      .max(MAX_PREFERENCE_CHARS)
      .describe(
        'The preference in the user\'s own terms, e.g. "Mornings work best for check-ins".'
      ),
  }),
  execute: async ({ text }) => {
    const { text: saved } = await savePreference(text)
    return { saved }
  },
})
