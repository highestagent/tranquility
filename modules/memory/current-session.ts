import { kv, newId, sessions } from "./repositories"
import type { Session } from "./schemas"

const KEY = "currentSessionId"

/**
 * Answers and game results in the same session are compared with each other,
 * so a session must stay short enough to describe one state of mind.
 */
const SESSION_WINDOW_MS = 3 * 60 * 60 * 1000

let lookup: Promise<Session> | null = null

async function findOrStartSession(now: number): Promise<Session> {
  const id = await kv.get<string>(KEY)
  const existing = id ? await sessions.get(id) : undefined
  if (existing && now - existing.startedAt < SESSION_WINDOW_MS) return existing

  const session = await sessions.put({ id: newId(), startedAt: now })
  await kv.set(KEY, session.id)
  return session
}

/**
 * Concurrent callers share one lookup. Otherwise, several saves at once in a
 * new session would each start their own session, and their answers would
 * never pair with a game result.
 */
export function getCurrentSession(now = Date.now()): Promise<Session> {
  lookup ??= findOrStartSession(now).finally(() => {
    lookup = null
  })
  return lookup
}
