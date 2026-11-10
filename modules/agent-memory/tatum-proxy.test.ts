import { GrpcTypes, RpcError, SuiGrpcClient } from "@mysten/sui/grpc"
import { expect, it, vi } from "vitest"

import { proxyToTatum } from "./tatum-proxy"

const { batchGetObjects, getTransaction } = vi.hoisted(() => ({
  batchGetObjects: vi.fn(),
  getTransaction: vi.fn(),
}))
vi.mock("./tatum", () => ({
  getTatumClient: () => ({
    ledgerService: { batchGetObjects, getTransaction },
  }),
}))

const baseUrl = "https://app.test/api/sui"

it.each(["binary", "text"] as const)(
  "bridges SDK %s framing and preserves not-found errors",
  async (format) => {
    const objectId = "0x" + "a".repeat(64)
    batchGetObjects.mockResolvedValue({
      response: GrpcTypes.BatchGetObjectsResponse.create(),
    })
    getTransaction.mockRejectedValue(
      new RpcError("Not indexed yet", "NOT_FOUND")
    )
    const rateWindows = new Map()
    const client = new SuiGrpcClient({
      network: "mainnet",
      baseUrl,
      format,
      fetch: (url, init) => {
        const request = new Request(url, init)
        request.headers.set("origin", "https://app.test")
        request.headers.set("host", "app.test")
        return proxyToTatum(request, request.url.slice(baseUrl.length + 1), {
          apiKey: "server-test-key",
          rateWindows,
        })
      },
    })

    await client.ledgerService.batchGetObjects({ requests: [{ objectId }] })
    expect(batchGetObjects).toHaveBeenCalledWith(
      expect.objectContaining({ requests: [{ objectId }] }),
      expect.objectContaining({ meta: { "x-api-key": "server-test-key" } })
    )
    await expect(
      client.ledgerService.getTransaction({ digest: "digest" }).response
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  }
)
