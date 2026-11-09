import { resumeRecalculation } from "@/modules/journal/corrections"
import { tool } from "ai"
import { z } from "zod"

import { recallForAgent } from "@/modules/agent-memory/recall"
import { getRestoredHandoffs } from "@/modules/agent-memory/sync"
import { getInvestigationState } from "@/modules/investigation"
import { measurements, responses, sessions, kv } from "@/modules/memory"
import { ASSESSMENTS } from "@/modules/assessments"
import { askedThisSession } from "@/modules/questionnaire"

import { summarizeCoverage } from "./coverage"
import { questionIdSchema, reasonSchema } from "./shared"

const RECENT_VALUES = 10
const DEFAULT_MEMORY_QUERY =
  "What has been learned about this person's sleep, habits, stress, mood, and thinking?"

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
    memoryQuery: z
      .string()
      .max(300)
      .optional()
      .describe(
        "What to look up in past findings, in plain language, such as the user's own question."
      ),
  }),
  execute: async ({ questionIds = [], memoryQuery }) => {
    await resumeRecalculation()
    // Restoring can add investigations from another device, so it comes first.
    const memory = await recallForAgent(async () => {
      const open = (await getInvestigationState()).open
      return memoryQuery ?? open[0]?.question ?? DEFAULT_MEMORY_QUERY
    })
    const [
      state,
      handoffs,
      sessionRows,
      asked,
      responseRows,
      runCounts,
      answers,
    ] = await Promise.all([
      getInvestigationState(),
      getRestoredHandoffs(),
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
      personalContext:
        (
          await kv.get<import("@/modules/session/checkpoint").ContextAnswer[]>(
            "contextAnswers"
          )
        )?.slice(-20) ?? [],
      memory,
      sessions: sessionRows.length,
      askedThisSession: [...asked],
      runs: runCounts,
      coverage: summarizeCoverage(responseRows),
      investigations: state.open.map((investigation) => {
        const handoff = handoffs[investigation.id]
        return handoff
          ? {
              ...investigation,
              fromAnotherDevice: {
                evidenceThere: handoff.evidence,
                lastVerifiedResult: handoff.latestFinding
                  ? {
                      observed: handoff.latestFinding.observed,
                      verdict: handoff.latestFinding.verdict,
                      grade: handoff.latestFinding.grade,
                      uncertainty: handoff.latestFinding.uncertainty,
                    }
                  : null,
              },
            }
          : investigation
      }),
      completedInvestigations: state.completedCount,
      answers,
    }
  },
})
