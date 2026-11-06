import { PrivyClient } from "@privy-io/node"

import type { RateWindows } from "@/lib/rate-limit"
import { handleMemoryRequest } from "@/modules/agent-memory/server"

const rateWindows: RateWindows = new Map()

let privy: PrivyClient | null = null
function getPrivy() {
  privy ??= new PrivyClient({
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
  })
  return privy
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params
  return handleMemoryRequest(request, action, {
    verifyToken: async (token) => {
      const claims = await getPrivy().utils().auth().verifyAccessToken(token)
      return claims.user_id
    },
    getEpoch: async (userId) => {
      const user = await getPrivy().users()._get(userId)
      const epoch = user.custom_metadata?.memoryEpoch
      return typeof epoch === "number" ? epoch : 0
    },
    setEpoch: async (userId, epoch) => {
      await getPrivy()
        .users()
        .setCustomMetadata(userId, {
          custom_metadata: { memoryEpoch: epoch },
        })
    },
    now: Date.now,
    rateWindows,
  })
}
