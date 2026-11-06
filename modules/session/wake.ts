import { kv } from "@/modules/memory"

/** After this long, the agent looks again even if nothing new has arrived. */
export const REST_WINDOW_MS = 6 * 60 * 60 * 1000

const REST_KEY = "agentRest"
const SEEN_KEY = "seenDiscoveriesAt"

export interface AgentRest {
  at: number
  spoken: string | null
}

/**
 * The agent wakes by itself when it has reason to, and otherwise rests. This
 * stops every page load from spending a model call on nothing new.
 */
export function shouldWake(input: {
  rest: AgentRest | null
  latestDataAt: number
  now: number
}) {
  if (!input.rest) return true
  if (input.latestDataAt > input.rest.at) return true
  return input.now - input.rest.at >= REST_WINDOW_MS
}

export async function getAgentRest() {
  return (await kv.get<AgentRest>(REST_KEY)) ?? null
}

export async function setAgentRest(rest: AgentRest) {
  await kv.set(REST_KEY, rest)
}

export async function getSeenDiscoveriesAt() {
  return (await kv.get<number>(SEEN_KEY)) ?? 0
}

export async function setSeenDiscoveriesAt(at: number) {
  await kv.set(SEEN_KEY, at)
}
