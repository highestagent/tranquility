import { createHash } from "node:crypto"

import { z } from "zod"

import { isOverLimit, type RateWindows } from "@/lib/rate-limit"
import { isSameOrigin } from "@/modules/relay/relay"

const RATE_LIMIT = { requests: 60, windowMs: 60_000 }
const MAX_BODY_BYTES = 64 * 1024
/** Weaker matches than this are more noise than memory. */
const MAX_DISTANCE = 0.8

const BODIES = {
  remember: z.object({
    items: z
      .array(z.object({ text: z.string().min(1).max(1200) }))
      .min(1)
      .max(10),
  }),
  status: z.object({
    jobIds: z.array(z.string().min(1).max(200)).min(1).max(40),
  }),
  recall: z.object({
    query: z.string().min(1).max(300),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  forget: z.object({}),
  info: z.object({}),
}

type Action = keyof typeof BODIES

/** The part of the Walrus Memory client this uses, so tests can use its mock. */
export interface MemoryClient {
  rememberBulkAsync(
    items: { text: string; namespace?: string }[]
  ): Promise<{ job_ids: string[] }>
  getRememberStatus(
    jobId: string
  ): Promise<{ status: string; namespace?: string }>
  recall(
    query: string,
    options: { limit?: number; namespace?: string; maxDistance?: number }
  ): Promise<{ results: { text: string; created_at?: string }[] }>
}

export interface MemoryDeps {
  /** Returns the user's ID, or throws if the token isn't valid. */
  verifyToken(token: string): Promise<string>
  getEpoch(userId: string): Promise<number>
  setEpoch(userId: string, epoch: number): Promise<void>
  /** `null` when this server has no Walrus Memory credentials. */
  client: MemoryClient | null
  now: () => number
  rateWindows: RateWindows
}

function reply(status: number, code: string) {
  return Response.json({ error: { code } }, { status })
}

/**
 * Each person's memories live in their own namespace, derived here from their
 * verified identity. A browser can't name a namespace, so it can't reach anyone
 * else's. The epoch changes the namespace, which is how "forget" works.
 */
export function namespaceFor(userId: string, epoch: number) {
  const digest = createHash("sha256")
    .update(`${userId}:${epoch}`)
    .digest("hex")
    .slice(0, 32)
  return `tranquility-${digest}`
}

/**
 * Stateless: it stores and logs nothing, and it holds the only copy of the
 * Walrus Memory key, which never reaches a browser.
 */
export async function handleMemoryRequest(
  request: Request,
  action: string,
  deps: MemoryDeps
): Promise<Response> {
  if (!isSameOrigin(request)) return reply(403, "cross_origin")
  if (!(action in BODIES)) return reply(404, "unknown_action")

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

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return reply(413, "too_large")
  let json: unknown
  try {
    json = JSON.parse(raw || "{}")
  } catch {
    return reply(400, "invalid_body")
  }
  const parsed = BODIES[action as Action].safeParse(json)
  if (!parsed.success) return reply(400, "invalid_body")

  try {
    if (action === "info") {
      return Response.json({ configured: deps.client !== null })
    }
    if (action === "forget") {
      await deps.setEpoch(userId, (await deps.getEpoch(userId)) + 1)
      return Response.json({ ok: true })
    }

    if (!deps.client) return reply(503, "not_configured")
    const namespace = namespaceFor(userId, await deps.getEpoch(userId))

    if (action === "remember") {
      const { items } = parsed.data as z.infer<typeof BODIES.remember>
      const { job_ids } = await deps.client.rememberBulkAsync(
        items.map(({ text }) => ({ text, namespace }))
      )
      return Response.json({ jobIds: job_ids })
    }
    if (action === "status") {
      const { jobIds } = parsed.data as z.infer<typeof BODIES.status>
      const jobs = await Promise.all(
        jobIds.map(async (jobId) => {
          const job = await deps.client!.getRememberStatus(jobId)
          // A job from another namespace is reported as if it doesn't exist.
          const mine = !job.namespace || job.namespace === namespace
          return { jobId, status: mine ? job.status : "not_found" }
        })
      )
      return Response.json({ jobs })
    }

    const { query, limit } = parsed.data as z.infer<typeof BODIES.recall>
    const { results } = await deps.client.recall(query, {
      limit: limit ?? 6,
      namespace,
      maxDistance: MAX_DISTANCE,
    })
    return Response.json({
      memories: results.map(({ text, created_at }) => ({
        text,
        at: created_at ?? null,
      })),
    })
  } catch {
    return reply(502, "unavailable")
  }
}
