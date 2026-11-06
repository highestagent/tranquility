import type { ModelMessage } from "ai"

/** Enough for a follow-up question to make sense. Facts come from the tools. */
const EARLIER_MESSAGES_KEPT = 6

function textOnly(message: ModelMessage): ModelMessage | null {
  if (message.role !== "user" && message.role !== "assistant") return null
  if (typeof message.content === "string") {
    return message.content.trim() ? message : null
  }
  const text = message.content.filter(
    (part) => part.type === "text" && part.text.trim()
  )
  return text.length > 0
    ? ({ ...message, content: text } as ModelMessage)
    : null
}

/**
 * The agent's memory lives in its tools, so earlier turns' tool calls and
 * results only add cost. This keeps the current turn intact and reduces
 * everything before it to the words exchanged, so a request stays the same size
 * however long the session runs.
 */
export function trimHistory(messages: readonly ModelMessage[]): ModelMessage[] {
  const currentTurn = messages.findLastIndex(({ role }) => role === "user")
  if (currentTurn === -1) return [...messages]

  const earlier = messages
    .slice(0, currentTurn)
    .flatMap((message) => textOnly(message) ?? [])
    .slice(-EARLIER_MESSAGES_KEPT)
  // Cutting can leave an assistant message first, which some providers refuse.
  const start = earlier.findIndex(({ role }) => role === "user")

  return [
    ...(start === -1 ? [] : earlier.slice(start)),
    ...messages.slice(currentTurn),
  ]
}
