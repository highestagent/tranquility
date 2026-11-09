import { tool } from "ai"
import { z } from "zod"
import {
  getCurrentSession,
  investigations,
  kv,
  sessions,
} from "@/modules/memory"
import { updateInvestigation } from "@/modules/investigation"
import { syncMemory } from "@/modules/agent-memory/sync"
import { setAgentRest } from "@/modules/session/wake"
import { getPendingTask } from "../pending-task"
export const restSession = tool({
  description:
    "Finish this session when enough useful work is done. Summarize what happened and suggest when another visit would be informative. Never starts an assessment.",
  inputSchema: z.object({
    reason: z.string().min(1).max(500),
    nextStep: z.string().min(1).max(500),
    afterHours: z.number().min(0.5).max(168),
  }),
  execute: async ({ reason, nextStep, afterHours }) => {
    if (await getPendingTask())
      throw new Error("An interaction still needs the user's response.")
    const session = await getCurrentSession()
    const at = Date.now()
    const nextAt = at + afterHours * 60 * 60 * 1000
    await kv.set(`sessionSummary:${session.id}`, {
      summary: reason,
      nextStep,
      nextAt,
    })
    await sessions.put({ ...session, endedAt: at })
    const active = (await investigations.list())
      .filter((row) => row.status === "active")
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (active) {
      await updateInvestigation(active.id, {
        nextStep,
        nextMeasurementAt: nextAt,
      })
    }
    await setAgentRest({ at, spoken: reason, nextAt })
    // Resting is where another device would pick up, so send the plan now.
    void syncMemory({ flush: true })
    return {
      status: "awaiting-user" as const,
      nextAt,
      note: "Session complete. Rest until the user returns or asks.",
    }
  },
})
