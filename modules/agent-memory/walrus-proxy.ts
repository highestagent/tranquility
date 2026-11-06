import { isOverLimit, type RateWindows } from "@/lib/rate-limit"
import { clientAddress, isSameOrigin } from "@/modules/relay/relay"

export const DEFAULT_RELAYER_URL = "https://relayer.dev.memwal.ai"

const RATE_LIMIT = { requests: 120, windowMs: 60_000 }
const MAX_BODY_BYTES = 64 * 1024
const TIMEOUT_MS = 30_000

/** The only Walrus Memory routes this app uses. */
const ROUTES: Record<string, RegExp> = {
  GET: /^(version|health|config|api\/accounts\/0x[0-9a-fA-F]{64}\/delegate-keys)$/,
  POST: /^(sponsor|sponsor\/execute|api\/recall|api\/remember\/bulk|api\/remember\/bulk\/status)$/,
}

const REQUEST_HEADERS = [
  "content-type",
  "x-public-key",
  "x-signature",
  "x-timestamp",
  "x-nonce",
  "x-account-id",
  "x-seal-session",
]
const RESPONSE_HEADERS = ["content-type", "retry-after", "x-auth-error"]

export interface WalrusProxyDeps {
  relayerUrl: string
  fetch: typeof fetch
  now: () => number
  rateWindows: RateWindows
}

function pick(headers: Headers, names: string[]) {
  const picked = new Headers()
  for (const name of names) {
    const value = headers.get(name)
    if (value) picked.set(name, value)
  }
  return picked
}

/** Browsers send no Origin header on a same-origin GET. */
function isFromThisApp(request: Request) {
  return request.method === "GET"
    ? request.headers.get("sec-fetch-site") === "same-origin"
    : isSameOrigin(request)
}

/**
 * The Walrus Memory relayer only accepts browsers from a list of origins, so
 * requests reach it through here. It holds no keys and adds no credentials: the
 * browser signs each request and the relayer checks that signature, so this can
 * only pass along what the signer already authorized. It stores and logs nothing.
 */
export async function proxyToWalrus(
  request: Request,
  path: string[],
  deps: WalrusProxyDeps
): Promise<Response> {
  if (!isFromThisApp(request)) {
    return new Response(null, { status: 403 })
  }
  const route = path.join("/")
  if (!ROUTES[request.method]?.test(route)) {
    return new Response(null, { status: 404 })
  }
  if (
    isOverLimit(
      deps.rateWindows,
      clientAddress(request),
      deps.now(),
      RATE_LIMIT
    )
  ) {
    return new Response(null, { status: 429 })
  }

  const body = request.method === "POST" ? await request.text() : undefined
  if (body && body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 })
  }

  try {
    const upstream = await deps.fetch(`${deps.relayerUrl}/${route}`, {
      method: request.method,
      headers: pick(request.headers, REQUEST_HEADERS),
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: pick(upstream.headers, RESPONSE_HEADERS),
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
