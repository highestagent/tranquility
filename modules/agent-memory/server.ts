import { isOverLimit, type RateWindows } from "@/lib/rate-limit"
import { isSameOrigin } from "@/modules/relay/relay"

import type { MemoryVerification } from "./tatum"

const RATE_LIMIT = { requests: 60, windowMs: 60_000 }
const VERIFICATION_LIMIT = { requests: 6, windowMs: 60_000 }

export interface MemoryDeps {
  /** Returns the user's ID, or throws if the token isn't valid. */
  verifyToken(token: string): Promise<string>
  getEpoch(userId: string): Promise<number>
  setEpoch(userId: string, epoch: number): Promise<void>
  verifyAccount(
    userId: string,
    signal: AbortSignal
  ): Promise<MemoryVerification>
  now: () => number
  rateWindows: RateWindows
}

function reply(status: number, code: string) {
  return Response.json({ error: { code } }, { status })
}

/**
 * Handles authenticated memory controls. The epoch makes "forget" reach
 * every device, and verification checks the wallet's account on Sui.
 */
export async function handleMemoryRequest(
  request: Request,
  action: string,
  deps: MemoryDeps
): Promise<Response> {
  if (!isSameOrigin(request)) return reply(403, "cross_origin")
  if (action !== "info" && action !== "forget" && action !== "verify") {
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

  const key = action === "verify" ? "verify:" + userId : userId
  const limit = action === "verify" ? VERIFICATION_LIMIT : RATE_LIMIT
  if (isOverLimit(deps.rateWindows, key, deps.now(), limit)) {
    return reply(429, "too_many_requests")
  }

  try {
    if (action === "verify") {
      return Response.json(await deps.verifyAccount(userId, request.signal))
    }
    const epoch = await deps.getEpoch(userId)
    if (action === "info") return Response.json({ epoch })
    await deps.setEpoch(userId, epoch + 1)
    return Response.json({ epoch: epoch + 1 })
  } catch {
    return reply(502, "unavailable")
  }
}
