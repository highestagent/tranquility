import { ChannelCredentials } from "@grpc/grpc-js"
import { SuiGrpcClient } from "@mysten/sui/grpc"
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils"
import { GrpcTransport } from "@protobuf-ts/grpc-transport"

import { RELAYER_URL } from "./walrus-proxy"

export type MemoryVerification =
  | { status: "verified"; accountId: string }
  | { status: "not_ready" | "unconfigured" | "mismatch" }

let client: SuiGrpcClient | undefined

/** Resolve the signed-in wallet's account via Walrus and verify it on Sui. */
export async function verifyWalrusAccount(
  walletAddress: string,
  apiKey: string,
  signal: AbortSignal
): Promise<MemoryVerification> {
  if (!isValidSuiAddress(walletAddress))
    throw new Error("Invalid Sui wallet address")
  const wallet = normalizeSuiAddress(walletAddress)

  const options = { cache: "no-store", signal } as const
  const [lookup, config] = await Promise.all([
    fetch(RELAYER_URL + "/api/accounts/" + wallet + "/delegate-keys", options),
    fetch(RELAYER_URL + "/config", options),
  ])
  if (!lookup.ok || !config.ok) throw new Error("Walrus account lookup failed")

  const { account_id: accountId } = (await lookup.json()) as {
    account_id?: unknown
  }
  if (accountId === null) return { status: "not_ready" }
  const { network, packageId } = (await config.json()) as {
    network?: unknown
    packageId?: unknown
  }
  if (
    typeof accountId !== "string" ||
    !isValidSuiAddress(accountId) ||
    network !== "mainnet" ||
    typeof packageId !== "string" ||
    !isValidSuiAddress(packageId)
  ) {
    throw new Error("Invalid Walrus mainnet account metadata")
  }

  client ??= new SuiGrpcClient({
    network: "mainnet",
    transport: new GrpcTransport({
      host: "sui-mainnet-grpc.gateway.tatum.io:443",
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  })
  const { response } = await client.ledgerService.getObject(
    {
      objectId: accountId,
      readMask: { paths: ["object_id", "object_type", "json"] },
    },
    { meta: { "x-api-key": apiKey }, abort: signal }
  )
  const object = response.object
  const json = object?.json?.kind
  const fields =
    json?.oneofKind === "structValue" ? json.structValue.fields : {}
  const owner = fields.owner?.kind
  const active = fields.active?.kind
  if (
    object?.objectId !== accountId ||
    object.objectType !== packageId + "::account::MemWalAccount" ||
    owner?.oneofKind !== "stringValue" ||
    !isValidSuiAddress(owner.stringValue) ||
    normalizeSuiAddress(owner.stringValue) !== wallet ||
    active?.oneofKind !== "boolValue" ||
    !active.boolValue
  ) {
    return { status: "mismatch" }
  }
  return { status: "verified", accountId }
}
