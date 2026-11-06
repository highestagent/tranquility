import { tool } from "ai"
import { z } from "zod"

import { getInvestigationState } from "@/modules/investigation"
import { measurements, responses, sessions } from "@/modules/memory"
import { ASSESSMENTS } from "@/modules/assessments"
import { askedThisSession } from "@/modules/questionnaire"

import { summarizeCoverage } from "./coverage"
import { questionIdSchema, reasonSchema } from "./shared"

const RECENT_VALUES = 10

export const getUserContext = tool({
  description:
    "Read investigation state, how much data exists, how many answers each question has (counts only), and recent answers to specific questions. Request only the questions you need.",
  inputSchema: z.object({
    reason: reasonSchema,
    questionIds: z
      .array(questionIdSchema)
      .max(8)
      .optional()
      .describe("Questions to retrieve answers for."),
  }),
  execute: async ({ questionIds = [] }) => {
    const [state, sessionRows, asked, responseRows, runCounts, answers] =
      await Promise.all([
        getInvestigationState(),
        sessions.list(),
        askedThisSession(),
        responses.list(),
        Promise.all(
          ASSESSMENTS.map(async ({ id }) => {
            const runs = await measurements.byAssessment(id)
            return {
              assessmentId: id,
              validRuns: runs.filter((r) => r.valid).length,
            }
          })
        ),
        Promise.all(
          questionIds.map(async (questionId) => {
            const rows = await responses.byQuestion(questionId)
            const answered = rows.filter((row) => row.value !== null)
            return {
              questionId,
              answered: answered.length,
              declined: rows.length - answered.length,
              recent: answered.slice(-RECENT_VALUES).map((row) => row.value),
            }
          })
        ),
      ])
    return {
      sessions: sessionRows.length,
      askedThisSession: [...asked],
      runs: runCounts,
      coverage: summarizeCoverage(responseRows),
      investigations: state.open,
      completedInvestigations: state.completedCount,
      answers,
    }
  },
})
