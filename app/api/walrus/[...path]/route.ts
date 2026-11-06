import type { RateWindows } from "@/lib/rate-limit"
import { proxyToWalrus, RELAYER_URL } from "@/modules/agent-memory/walrus-proxy"

const rateWindows: RateWindows = new Map()

async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyToWalrus(request, path, {
    relayerUrl: RELAYER_URL,
    fetch,
    now: Date.now,
    rateWindows,
  })
}

export const GET = handle
export const POST = handle
