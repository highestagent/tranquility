import type { RateWindows } from "@/lib/rate-limit"
import { proxyToTatum } from "@/modules/agent-memory/tatum-proxy"

export const runtime = "nodejs"

const rateWindows: RateWindows = new Map()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyToTatum(request, (await params).path.join("/"), {
    apiKey: process.env.TATUM_API_KEY?.trim(),
    rateWindows,
  })
}
