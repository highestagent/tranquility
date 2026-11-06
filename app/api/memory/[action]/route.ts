import { MemWal } from "@mysten-incubation/memwal"
import { PrivyClient } from "@privy-io/node"

import type { RateWindows } from "@/lib/rate-limit"
import {
  handleMemoryRequest,
  type MemoryClient,
} from "@/modules/agent-memory/server"

const rateWindows: RateWindows = new Map()

let privy: PrivyClient | null = null
function getPrivy() {
  privy ??= new PrivyClient({
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
  })
  return privy
}

let memoryClient: MemoryClient | null | undefined
function getMemoryClient() {
  if (memoryClient === undefined) {
    const key = process.env.MEMWAL_PRIVATE_KEY
    const accountId = process.env.MEMWAL_ACCOUNT_ID
    memoryClient =
      key && accountId
        ? (MemWal.create({
            key,
            accountId,
            serverUrl: process.env.MEMWAL_SERVER_URL,
          }) as unknown as MemoryClient)
        : null
  }
  return memoryClient
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
    client: getMemoryClient(),
    now: Date.now,
    rateWindows,
  })
}
