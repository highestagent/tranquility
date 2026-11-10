import { bcs } from "@mysten/sui/bcs"
import {
  messageWithIntent,
  toSerializedSignature,
} from "@mysten/sui/cryptography"
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519"
import {
  fromBase58,
  fromHex,
  normalizeSuiAddress,
  toHex,
} from "@mysten/sui/utils"
import { blake2b } from "@noble/hashes/blake2.js"
import { sha256 } from "@noble/hashes/sha2.js"

import type { AccountWallet } from "./api"

const DELEGATE_KEY_TAG = "tranquility/memory-delegate-key/v1"
const BACKUP_KEY_TAG = "tranquility/backup-key/v1"

export interface SuiWallet {
  address: string
  publicKey: Ed25519PublicKey
  /** Signs exactly these bytes, with no hashing or intent added. */
  signRaw(bytes: Uint8Array): Promise<Uint8Array>
}

function decodePublicKey(encoded: string, address: string) {
  // Privy documents base58 for Sui but hex for its other Ed25519 chains. The
  // address is derived from the key, so it confirms which reading is right.
  const decoders = [fromBase58, fromHex]
  for (const decode of decoders) {
    try {
      const bytes = decode(encoded)
      const key = new Ed25519PublicKey(
        bytes.length === 33 && bytes[0] === 0 ? bytes.slice(1) : bytes
      )
      if (key.toSuiAddress() === normalizeSuiAddress(address)) return key
    } catch {
      // Not this encoding. Try the next one.
    }
  }
  throw new Error("Couldn't read the wallet's public key")
}

export function toSuiWallet(wallet: AccountWallet): SuiWallet {
  if (!wallet.publicKey) throw new Error("The wallet has no public key")
  return {
    address: wallet.address,
    publicKey: decodePublicKey(wallet.publicKey, wallet.address),
    signRaw: async (bytes) =>
      fromHex(await wallet.signRawHash(`0x${toHex(bytes)}`)),
  }
}

async function signIntent(wallet: SuiWallet, intentMessage: Uint8Array) {
  const signature = await wallet.signRaw(blake2b(intentMessage, { dkLen: 32 }))
  return toSerializedSignature({
    signature,
    signatureScheme: "ED25519",
    publicKey: wallet.publicKey,
  })
}

export function signPersonalMessage(wallet: SuiWallet, message: Uint8Array) {
  return signIntent(
    wallet,
    messageWithIntent(
      "PersonalMessage",
      bcs.byteVector().serialize(message).toBytes()
    )
  )
}

export function signTransaction(wallet: SuiWallet, transaction: Uint8Array) {
  return signIntent(wallet, messageWithIntent("TransactionData", transaction))
}

/**
 * The seed of the key that signs memory requests, derived from the wallet so
 * it's never stored, can't end up in an export, and is the same on every device.
 * Ed25519 signatures are deterministic, so the same wallet always gets the same
 * seed. This hash can't collide with a transaction, since those are signed as
 * blake2b hashes of an intent message.
 */
export async function deriveDelegateSeed(wallet: SuiWallet) {
  const tag = new TextEncoder().encode(DELEGATE_KEY_TAG)
  return sha256(await wallet.signRaw(sha256(tag)))
}

/**
 * The key backups are encrypted with, derived the same way as the delegate
 * seed but from a different tag, so the two can't be related. Every device the
 * person signs in on derives the same key, and it's never stored or sent.
 */
export async function deriveBackupSeed(wallet: SuiWallet) {
  const tag = new TextEncoder().encode(BACKUP_KEY_TAG)
  return sha256(await wallet.signRaw(sha256(tag)))
}
