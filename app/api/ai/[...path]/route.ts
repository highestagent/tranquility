import { relay } from "@/modules/relay/relay"

const rateWindows = new Map<string, { start: number; count: number }>()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return relay(request, path, {
    apiKey: process.env.AI_GATEWAY_API_KEY,
    fetch,
    now: Date.now,
    rateWindows,
  })
}
