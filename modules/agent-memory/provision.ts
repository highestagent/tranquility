import { createSponsorAuthorization } from "@mysten-incubation/memwal"
import {
  addDelegateKey,
  createAccount,
} from "@mysten-incubation/memwal/account"
import { SuiGrpcClient } from "@mysten/sui/grpc"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { fromBase64, toBase64, toHex } from "@mysten/sui/utils"

import { kv } from "@/modules/memory"

import {
  deriveDelegateSeed,
  signPersonalMessage,
  signTransaction,
  type SuiWallet,
} from "./wallet"

const SAVED_ACCOUNT_KEY = "agentMemoryAccount"
const KEY_LABEL = "Tranquility"

interface SavedAccount {
  owner: string
  accountId: string
}

interface RelayerConfig {
  packageId: string
  registryId: string
  network: "mainnet" | "testnet"
  suiGrpcUrl: string
}

async function relayerRequest<T>(
  url: string,
  init?: { body: object }
): Promise<T> {
  const response = await fetch(
    url,
    init
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(init.body),
        }
      : undefined
  )
  if (!response.ok) {
    throw new Error(`Walrus Memory request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

/**
 * Walrus Memory pays the gas, so the wallet never needs funding. Each transaction
 * is built without gas, sponsored, signed by the wallet, then executed.
 */
export function sponsoredSigner(
  wallet: SuiWallet,
  suiClient: unknown,
  relayerUrl: string
) {
  return {
    address: wallet.address,
    signPersonalMessage: async ({ message }: { message: Uint8Array }) => ({
      signature: await signPersonalMessage(wallet, message),
    }),
    signAndExecuteTransaction: async ({
      transaction,
    }: {
      transaction: {
        build(options: {
          client: unknown
          onlyTransactionKind: true
        }): Promise<Uint8Array>
      }
    }) => {
      const kind = await transaction.build({
        client: suiClient,
        onlyTransactionKind: true,
      })
      const authorization = await createSponsorAuthorization(
        wallet.address,
        kind,
        async (message) => ({
          signature: await signPersonalMessage(wallet, message),
        })
      )
      const sponsored = await relayerRequest<{ bytes: string; digest: string }>(
        `${relayerUrl}/sponsor`,
        {
          body: {
            transactionBlockKindBytes: toBase64(kind),
            sender: wallet.address,
            ...authorization,
          },
        }
      )
      return relayerRequest<{ digest: string }>(
        `${relayerUrl}/sponsor/execute`,
        {
          body: {
            digest: sponsored.digest,
            sender: wallet.address,
            signature: await signTransaction(
              wallet,
              fromBase64(sponsored.bytes)
            ),
          },
        }
      )
    },
  }
}

/**
 * Finds this wallet's Walrus Memory account, creating whatever's missing. The
 * chain is the record of what's done, so an interrupted setup resumes here.
 */
export async function connectMemoryAccount(
  wallet: SuiWallet,
  relayerUrl: string
) {
  const seed = await deriveDelegateSeed(wallet)
  const key = toHex(seed)

  const saved = await kv.get<SavedAccount>(SAVED_ACCOUNT_KEY)
  if (saved?.owner === wallet.address) {
    return { accountId: saved.accountId, key }
  }

  const publicKey = toHex(
    Ed25519Keypair.fromSecretKey(seed).getPublicKey().toRawBytes()
  )
  const found = await relayerRequest<{
    account_id: string | null
    keys: { public_key: string }[]
  }>(`${relayerUrl}/api/accounts/${wallet.address}/delegate-keys`)
  let accountId = found.account_id

  if (!accountId || !found.keys.some((k) => k.public_key === publicKey)) {
    // A signer that varied would register a new key on every visit, and an
    // account can only hold 20. Better to find out before writing anything.
    if (toHex(await deriveDelegateSeed(wallet)) !== key) {
      throw new Error("The wallet's signatures aren't deterministic")
    }

    const config = await relayerRequest<RelayerConfig>(`${relayerUrl}/config`)
    const suiClient = new SuiGrpcClient({
      network: config.network,
      baseUrl: config.suiGrpcUrl,
    })
    const chain = {
      packageId: config.packageId,
      registryId: config.registryId,
      suiClient,
      walletSigner: sponsoredSigner(wallet, suiClient, relayerUrl),
    }
    accountId ??= (await createAccount(chain)).accountId
    await addDelegateKey({
      ...chain,
      accountId,
      publicKey,
      label: KEY_LABEL,
    })
  }

  await kv.set(SAVED_ACCOUNT_KEY, {
    owner: wallet.address,
    accountId,
  } satisfies SavedAccount)
  return { accountId, key }
}
