import {
  isStepCount,
  ToolLoopAgent,
  type LanguageModel,
  type StopCondition,
} from "ai"

import { decisions, getCurrentSession, newId } from "@/modules/memory"

import { buildInstructions } from "./instructions"
import { activeToolsFor, stageFor } from "./policy"
import { investigationTools, type InvestigationTools } from "./tools"

const MAX_STEPS = 12

/** The turn ends once the user has something to do. */
const awaitingUser: StopCondition<InvestigationTools> = ({ steps }) =>
  steps.at(-1)?.toolResults.some(({ output }) => {
    return (
      (output as { status?: string } | undefined)?.status === "awaiting-user"
    )
  }) ?? false

async function logDecision(toolName: string, input: unknown) {
  const reason = (input as { reason?: string; investigationId?: string }) ?? {}
  const session = await getCurrentSession()
  await decisions.put({
    id: newId(),
    sessionId: session.id,
    action: toolName,
    reason: reason.reason ?? "",
    at: Date.now(),
    investigationId: reason.investigationId,
  })
}

export function createInvestigationAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: buildInstructions(),
    tools: investigationTools,
    // One at a time keeps writes in the order the model chose them.
    toolCallConcurrency: 1,
    maxOutputTokens: 1500,
    stopWhen: [isStepCount(MAX_STEPS), awaitingUser],
    prepareStep: ({ steps }) => {
      const called = steps.flatMap((step) =>
        step.toolCalls.map((call) => call.toolName)
      )
      const stage = stageFor(called)
      return {
        activeTools: activeToolsFor(stage),
        ...(stage === "understand" ? { toolChoice: "required" as const } : {}),
      }
    },
    onToolExecutionEnd: async ({ toolCall, toolOutput }) => {
      if (toolOutput.type === "tool-result") {
        await logDecision(toolCall.toolName, toolCall.input)
      }
    },
  })
}
