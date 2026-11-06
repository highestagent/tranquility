import { Chat } from "@ai-sdk/react"
import { DirectChatTransport, type ChatTransport, type UIMessage } from "ai"

import { createInvestigationAgent } from "@/modules/agent/agent"
import { createBrowserModel } from "@/modules/agent/model"

import { syncMemory } from "@/modules/agent-memory/sync"

import { deriveActivity } from "./activity"
import { setAgentRest } from "./wake"

let chat: Chat<UIMessage> | null = null

/**
 * One agent for the whole visit. It lives outside any screen, so it keeps
 * working while the user looks at another page, and they come back to its
 * current state instead of a silently dropped turn.
 */
export function getAgentChat() {
  chat ??= new Chat<UIMessage>({
    transport: new DirectChatTransport({
      agent: createInvestigationAgent(createBrowserModel()),
      onError: (error) =>
        error instanceof Error ? error.message : "Unknown error",
    }) as unknown as ChatTransport<UIMessage>,
  })
  return chat
}

/** Runs a turn to the end and remembers it, whichever screen is showing. */
export async function runAgentTurn(send: () => Promise<void>) {
  const current = getAgentChat()
  await send()
  if (!current.error) {
    await setAgentRest({
      at: Date.now(),
      spoken: deriveActivity(current.messages).spoken,
    })
  }
  // What this turn concluded is saved in the background.
  void syncMemory()
}
