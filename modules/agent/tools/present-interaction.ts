import { tool } from "ai"
import { z } from "zod"
import { interactionSchema } from "@/modules/interaction/catalog"
import { discoveries } from "@/modules/memory"
import { getAssessment } from "@/modules/assessments"
import { getPendingTask, setPendingTask } from "../pending-task"

export const presentInteraction = tool({
  description:
    "Present one registered interaction. Use selectQuestions for standard sleep, mood, stress and energy ratings and selectAssessment for games. Evidence and charts accept only existing record IDs, never invented values. ConsentPrompt records a preference only; it cannot enable cloud or synchronization permissions.",
  inputSchema: z.object({
    message: z.string().min(1).max(500),
    reason: z.string().min(1).max(500),
    interaction: interactionSchema,
  }),
  execute: async ({ message, reason, interaction }) => {
    if (await getPendingTask())
      throw new Error("An interaction is already pending. End your turn.")
    if (interaction.type === "AssessmentCard")
      throw new Error("Use selectAssessment so measurement rules are enforced.")
    if (
      interaction.type === "EvidenceCard" &&
      !(await discoveries.get(interaction.props.discoveryId))
    )
      throw new Error("Finding does not exist.")
    if (
      interaction.type === "ChartView" &&
      !getAssessment(interaction.props.assessmentId)?.metrics.some(
        (m) => m.id === interaction.props.metricId
      )
    )
      throw new Error("Unknown metric.")
    await setPendingTask({ kind: "interaction", reason, message, interaction })
    return { status: "awaiting-user" as const }
  },
})
