import { isOverLimit, type RateWindows } from "@/lib/rate-limit"
import { isSameOrigin } from "@/modules/relay/relay"

const RATE_LIMIT = { requests: 60, windowMs: 60_000 }

export interface MemoryDeps {
  /** Returns the user's ID, or throws if the token isn't valid. */
  verifyToken(token: string): Promise<string>
  getEpoch(userId: string): Promise<number>
  setEpoch(userId: string, epoch: number): Promise<void>
  now: () => number
  rateWindows: RateWindows
}

function reply(status: number, code: string) {
  return Response.json({ error: { code } }, { status })
}

/**
 * The one thing about memory that has to be kept outside a person's Walrus
 * account: which namespace is current. It's how "forget" reaches every device.
 * It never sees a memory or a key.
 */
export async function handleMemoryRequest(
  request: Request,
  action: string,
  deps: MemoryDeps
): Promise<Response> {
  if (!isSameOrigin(request)) return reply(403, "cross_origin")
  if (action !== "info" && action !== "forget") {
    return reply(404, "unknown_action")
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return reply(401, "unauthorized")
  let userId: string
  try {
    userId = await deps.verifyToken(token)
  } catch {
    return reply(401, "unauthorized")
  }

  if (isOverLimit(deps.rateWindows, userId, deps.now(), RATE_LIMIT)) {
    return reply(429, "too_many_requests")
  }

  try {
    const epoch = await deps.getEpoch(userId)
    if (action === "info") return Response.json({ epoch })
    await deps.setEpoch(userId, epoch + 1)
    return Response.json({ epoch: epoch + 1 })
  } catch {
    return reply(502, "unavailable")
  }
}
