import type { UIMessage } from "ai"

/** Reads the latest tool reason and the reply that follows the tool calls. */
export function deriveActivity(messages: readonly UIMessage[]) {
  const last = messages.at(-1)
  if (last?.role !== "assistant") return { caption: null, spoken: null }

  let caption: string | null = null
  let lastToolIndex = -1
  for (const [index, part] of last.parts.entries()) {
    if (!part.type.startsWith("tool-")) continue
    lastToolIndex = index
    const reason = (part as { input?: { reason?: unknown } }).input?.reason
    if (typeof reason === "string") caption = reason
  }

  const spoken = last.parts
    .slice(lastToolIndex + 1)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("")
    .trim()

  return { caption, spoken: spoken || null }
}
