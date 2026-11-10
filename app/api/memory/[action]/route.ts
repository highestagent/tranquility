import { PrivyClient } from "@privy-io/node"

import type { RateWindows } from "@/lib/rate-limit"
import { handleMemoryRequest } from "@/modules/agent-memory/server"

export const runtime = "nodejs"

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
    verifyAccount: async (userId, signal) => {
      const apiKey = process.env.TATUM_API_KEY?.trim()
      if (!apiKey) return { status: "unconfigured" }

      const deadline = AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      const user = await getPrivy().users()._get(userId, { signal: deadline })
      for (const linked of user.linked_accounts) {
        if (linked.type === "wallet" && linked.chain_type === "sui") {
          const { verifyWalrusAccount } =
            await import("@/modules/agent-memory/tatum")
          return verifyWalrusAccount(linked.address, apiKey, deadline)
        }
      }
      return { status: "not_ready" }
    },
    now: Date.now,
    rateWindows,
  })
}
