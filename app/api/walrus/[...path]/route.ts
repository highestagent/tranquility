import type { RateWindows } from "@/lib/rate-limit"
import {
  DEFAULT_RELAYER_URL,
  proxyToWalrus,
} from "@/modules/agent-memory/walrus-proxy"

const rateWindows: RateWindows = new Map()

async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyToWalrus(request, path, {
    relayerUrl: process.env.MEMWAL_SERVER_URL ?? DEFAULT_RELAYER_URL,
    fetch,
    now: Date.now,
    rateWindows,
  })
}

export const GET = handle
export const POST = handle
