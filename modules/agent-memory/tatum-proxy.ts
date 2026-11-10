import { GrpcStatusCode, GrpcTypes, RpcError } from "@mysten/sui/grpc"

import { isOverLimit, type RateWindows } from "@/lib/rate-limit"
import { clientAddress, isSameOrigin } from "@/modules/relay/relay"

import { getTatumClient } from "./tatum"

const MAX_BODY_BYTES = 16 * 1024
const RATE_LIMIT = { requests: 120, windowMs: 60_000 }

async function readFrame(request: Request, text: boolean) {
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const wire = Buffer.concat(chunks)
  const frame = text ? Buffer.from(wire.toString("ascii"), "base64") : wire
  if (
    frame.length < 5 ||
    frame[0] !== 0 ||
    frame.readUInt32BE(1) !== frame.length - 5
  ) {
    return null
  }
  return frame.subarray(5)
}

function frame(payload: Uint8Array, flag: number) {
  const result = Buffer.alloc(5 + payload.length)
  result[0] = flag
  result.writeUInt32BE(payload.length, 1)
  result.set(payload, 5)
  return result
}

function grpcResponse(text: boolean, status: number, payload?: Uint8Array) {
  const trailers = frame(Buffer.from("grpc-status: " + status + "\r\n"), 0x80)
  const wire = payload ? Buffer.concat([frame(payload, 0), trailers]) : trailers
  return new Response(text ? wire.toString("base64") : new Uint8Array(wire), {
    headers: {
      "content-type": text
        ? "application/grpc-web-text"
        : "application/grpc-web+proto",
      "cache-control": "no-store",
    },
  })
}

export async function proxyToTatum(
  request: Request,
  method: string,
  { apiKey, rateWindows }: { apiKey?: string; rateWindows: RateWindows }
) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 })

  const type = request.headers.get("content-type")
  const text =
    type === "application/grpc-web-text" ||
    type === "application/grpc-web-text+proto"
  if (!text && type !== "application/grpc-web+proto") {
    return new Response(null, { status: 415 })
  }
  if (
    isOverLimit(rateWindows, clientAddress(request), Date.now(), RATE_LIMIT)
  ) {
    return new Response(null, { status: 429 })
  }
  if (!apiKey) return grpcResponse(text, GrpcStatusCode.UNAVAILABLE)

  const input = await readFrame(request, text)
  if (!input) return grpcResponse(text, GrpcStatusCode.INVALID_ARGUMENT)

  const { ledgerService, transactionExecutionService } = getTatumClient()
  const options = {
    meta: { "x-api-key": apiKey },
    abort: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
  }

  try {
    let output: Uint8Array
    switch (method) {
      case "sui.rpc.v2.LedgerService/BatchGetObjects": {
        const query = GrpcTypes.BatchGetObjectsRequest.fromBinary(input)
        if (query.requests.length > 10) {
          return grpcResponse(text, GrpcStatusCode.INVALID_ARGUMENT)
        }
        const { response } = await ledgerService.batchGetObjects(query, options)
        output = GrpcTypes.BatchGetObjectsResponse.toBinary(response)
        break
      }
      case "sui.rpc.v2.LedgerService/GetTransaction": {
        const query = GrpcTypes.GetTransactionRequest.fromBinary(input)
        const { response } = await ledgerService.getTransaction(query, options)
        output = GrpcTypes.GetTransactionResponse.toBinary(response)
        break
      }
      case "sui.rpc.v2.TransactionExecutionService/SimulateTransaction": {
        const query = GrpcTypes.SimulateTransactionRequest.fromBinary(input)
        if (query.doGasSelection) {
          return grpcResponse(text, GrpcStatusCode.INVALID_ARGUMENT)
        }
        const { response } =
          await transactionExecutionService.simulateTransaction(query, options)
        output = GrpcTypes.SimulateTransactionResponse.toBinary(response)
        break
      }
      default:
        return grpcResponse(text, GrpcStatusCode.UNIMPLEMENTED)
    }
    return grpcResponse(text, GrpcStatusCode.OK, output)
  } catch (error) {
    const status =
      error instanceof RpcError
        ? GrpcStatusCode[error.code as keyof typeof GrpcStatusCode]
        : undefined
    return grpcResponse(
      text,
      typeof status === "number" ? status : GrpcStatusCode.INTERNAL
    )
  }
}
