import { tool } from "ai"
import { z } from "zod"

import {
  listPreferences,
  removePreference,
  savePreference,
} from "@/modules/agent-memory/preferences"
import { MAX_PREFERENCE_CHARS } from "@/modules/agent-memory/records"

import { reasonSchema, requireField } from "./shared"

export const managePreferences = tool({
  description: `Keep what the user explicitly asks you to remember, such as when check-ins suit them. It follows them to their other devices.
- "remember": a new preference, in the user's own terms. Needs text.
- "change": the user corrected one. Needs preferenceId and text.
- "forget": the user asked you to forget one. Needs preferenceId.
Preference IDs are in memory.preferences from getUserContext.`,
  inputSchema: z.object({
    reason: reasonSchema,
    action: z.enum(["remember", "change", "forget"]),
    preferenceId: z.string().optional(),
    text: z.string().min(1).max(MAX_PREFERENCE_CHARS).optional(),
  }),
  execute: async (input) => {
    if (input.action === "remember") {
      const { id, text } = await savePreference(
        requireField(input.text, "text")
      )
      return { preferenceId: id, text }
    }
    const id = requireField(input.preferenceId, "preferenceId")
    if (!(await listPreferences()).some((preference) => preference.id === id)) {
      throw new Error("Unknown preference. Use an ID from memory.preferences.")
    }
    if (input.action === "forget") {
      await removePreference(id)
      return { preferenceId: id, forgotten: true }
    }
    const { text } = await savePreference(requireField(input.text, "text"), id)
    return { preferenceId: id, text }
  },
})
