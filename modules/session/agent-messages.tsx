"use client"

import type { UIMessage } from "ai"

interface HiddenMetadata {
  hidden?: boolean
}

interface ToolPartLike {
  type: string
  state?: string
  input?: { reason?: string }
}

export function AgentMessages({ messages }: { messages: UIMessage[] }) {
  const visible = messages.filter(
    (message) => !(message.metadata as HiddenMetadata | undefined)?.hidden
  )
  if (visible.length === 0) return null

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation with the agent"
      className="flex flex-col gap-3"
    >
      {visible.map((message) =>
        message.role === "user" ? (
          <p
            key={message.id}
            className="self-end bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
          >
            {message.parts.flatMap((part) =>
              part.type === "text" ? [part.text] : []
            )}
          </p>
        ) : (
          <div key={message.id} className="flex flex-col gap-2 text-sm">
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <p key={index} className="text-pretty whitespace-pre-wrap">
                    {part.text}
                  </p>
                )
              }
              const tool = part as ToolPartLike
              // A failed call is corrected by the agent, so it isn't shown.
              // The task card shows the reason for selecting a task.
              if (
                !tool.type.startsWith("tool-") ||
                tool.type.startsWith("tool-select") ||
                tool.state === "output-error" ||
                !tool.input?.reason
              ) {
                return null
              }
              return (
                <p key={index} className="text-xs text-muted-foreground">
                  {tool.input.reason}
                </p>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
