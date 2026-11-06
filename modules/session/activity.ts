import type { UIMessage } from "ai"

import type { Stage } from "@/modules/insights/agent-pool"
import type { MapFocus } from "@/modules/insights/knowledge-map"
import { getQuestion } from "@/modules/questionnaire"

const TOOL_STAGES: Record<string, Stage> = {
  getUserContext: "understand",
  getMeasurements: "understand",
  selectQuestions: "question",
  selectAssessment: "assess",
  analyzePerformance: "analyze",
  manageHypotheses: "reason",
  evaluateEvidence: "reason",
  planInvestigation: "adapt",
  saveInvestigation: "adapt",
}

interface ToolPart {
  type: string
  state?: string
  input?: Record<string, unknown>
}

export interface Activity {
  /** Where the agent is in its cycle, from the tool it called last. */
  stage: Stage | null
  visited: Stage[]
  /** The agent's stated reason for what it's doing right now. */
  caption: string | null
  /** The habit and ability the agent is working on. */
  focus: MapFocus | null
  scanning: boolean
  /** What the agent said after its last tool call. */
  spoken: string | null
  /** The user's own latest question, as opposed to the app's hidden turns. */
  asked: string | null
  completedTools: number
}

function isToolPart(part: { type: string }) {
  return part.type.startsWith("tool-")
}

function focusFrom(input: ToolPart["input"]): MapFocus | null {
  const factorId = input?.factorId
  const assessmentId = input?.assessmentId
  if (typeof factorId !== "string" || typeof assessmentId !== "string") {
    return null
  }
  const domain = getQuestion(factorId)?.domain
  return domain ? { domain, assessmentId } : null
}

/** Reads what the agent is doing from its live message stream. */
export function deriveActivity(messages: readonly UIMessage[]): Activity {
  const lastUser = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "user" &&
        !(message.metadata as { hidden?: boolean } | undefined)?.hidden
    )
  const asked =
    lastUser?.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join(" ") ?? null

  const last = messages.at(-1)
  if (last?.role !== "assistant") {
    return {
      stage: null,
      visited: [],
      caption: null,
      focus: null,
      scanning: false,
      spoken: null,
      asked,
      completedTools: 0,
    }
  }

  const tools = last.parts.filter(isToolPart) as unknown as ToolPart[]
  const stageOf = (part: ToolPart) =>
    TOOL_STAGES[part.type.slice("tool-".length)]
  const lastTool = tools.at(-1)

  let caption: string | null = null
  let focus: MapFocus | null = null
  for (const part of tools) {
    const reason = part.input?.reason
    if (typeof reason === "string") caption = reason
    focus = focusFrom(part.input) ?? focus
  }

  const lastToolIndex = last.parts.findLastIndex((part) => isToolPart(part))
  const spoken = last.parts
    .slice(lastToolIndex + 1)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("")
    .trim()

  return {
    stage: lastTool ? (stageOf(lastTool) ?? null) : null,
    visited: [...new Set(tools.flatMap((part) => stageOf(part) ?? []))],
    caption,
    focus,
    scanning:
      lastTool?.type === "tool-analyzePerformance" &&
      lastTool.input?.mode === "scan" &&
      lastTool.state !== "output-available",
    spoken: spoken || null,
    asked,
    completedTools: tools.filter((part) => part.state === "output-available")
      .length,
  }
}
