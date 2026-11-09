import { isCloudAiEnabled } from "@/modules/agent/consent"

import { memoryApi, type RecalledMemory } from "./api"
import { getMemoryState } from "./sync"

const RECALL_LIMIT = 6
/**
 * The agent shouldn't wait on memory for long: without it, it still works. A
 * fresh page was measured at about 5.4s on mainnet, connecting included.
 */
const RECALL_BUDGET_MS = 10_000

/**
 * What the agent concluded in past sessions, possibly on another device. Any
 * failure means no memories this turn, never a failed turn.
 */
export async function recallMemories(query: string): Promise<RecalledMemory[]> {
  try {
    const [enabled, state] = await Promise.all([
      isCloudAiEnabled(),
      getMemoryState(),
    ])
    if (!enabled || !state.enabled) return []
    const { memories } = await memoryApi.recall(
      query,
      RECALL_LIMIT,
      RECALL_BUDGET_MS
    )
    return memories
  } catch {
    return []
  }
}
