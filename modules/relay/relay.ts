import { isOverLimit, type RateWindows } from "@/lib/rate-limit"

import { AGENT_MODEL } from "./config"

const UPSTREAM = "https://ai-gateway.vercel.sh/v4/ai"
const ALLOWED_PATHS = new Set(["language-model"])
const ALLOWED_MODELS = new Set<string>([AGENT_MODEL])
const MAX_BODY_BYTES = 1024 * 1024

/** Only what the gateway needs. Nothing else from the browser is passed on. */
const FORWARDED_HEADERS = [
  "content-type",
  "ai-gateway-protocol-version",
  "ai-language-model-specification-version",
  "ai-language-model-id",
  "ai-language-model-streaming",
]

const RATE_LIMIT = { requests: 60, windowMs: 60_000 }

export interface RelayDeps {
  apiKey: string | undefined
  fetch: typeof fetch
  now: () => number
  /** Request counts per client, holding no request content. */
  rateWindows: RateWindows
}

function reject(status: number, message: string) {
  return Response.json({ error: { message, type: "relay_error" } }, { status })
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function isRateLimited(request: Request, deps: RelayDeps) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  return isOverLimit(deps.rateWindows, client, deps.now(), RATE_LIMIT)
}

/**
 * Stateless forwarder that keeps the gateway key on the server. It stores and
 * logs no request content, so personal data only passes through it.
 */
export async function relay(
  request: Request,
  path: readonly string[],
  deps: RelayDeps
): Promise<Response> {
  if (!isSameOrigin(request))
    return reject(403, "Cross-origin request refused.")
  if (isRateLimited(request, deps)) {
    return reject(429, "Too many requests. Wait a minute, then try again.")
  }

  const target = path.join("/")
  if (!ALLOWED_PATHS.has(target)) return reject(404, "Unknown relay path.")

  const model = request.headers.get("ai-language-model-id")
  if (!model || !ALLOWED_MODELS.has(model)) {
    return reject(400, "This model isn't available.")
  }
  if (!deps.apiKey) {
    return reject(503, "AI isn't configured on this server.")
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_BODY_BYTES) {
    return reject(413, "This request is too large.")
  }
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BODY_BYTES) {
    return reject(413, "This request is too large.")
  }

  const headers = new Headers({
    authorization: `Bearer ${deps.apiKey}`,
    "ai-gateway-auth-method": "api-key",
  })
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  let upstream: Response
  try {
    upstream = await deps.fetch(`${UPSTREAM}/${target}`, {
      method: "POST",
      headers,
      body,
      signal: request.signal,
    })
  } catch {
    return reject(502, "Couldn't reach the AI service.")
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  })
}
