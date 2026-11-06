import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { toBase58, toHex } from "@mysten/sui/utils"
import {
  verifyPersonalMessageSignature,
  verifyTransactionSignature,
} from "@mysten/sui/verify"
import { describe, expect, it, vi } from "vitest"

import type { AccountWallet } from "./api"
import {
  deriveDelegateSeed,
  signPersonalMessage,
  signTransaction,
  toSuiWallet,
} from "./wallet"

const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7))
const address = keypair.getPublicKey().toSuiAddress()
const rawPublicKey = keypair.getPublicKey().toRawBytes()

/** Behaves like Privy's raw signing: it signs the given bytes as they are. */
function privyWallet(publicKey = toBase58(rawPublicKey)): AccountWallet {
  return {
    address,
    publicKey,
    signRawHash: async (hash) => {
      const bytes = Uint8Array.from(
        hash
          .slice(2)
          .match(/../g)!
          .map((byte) => parseInt(byte, 16))
      )
      return `0x${toHex(await keypair.sign(bytes))}`
    },
  }
}

const wallet = toSuiWallet(privyWallet())

describe("toSuiWallet", () => {
  it.each([
    ["base58", toBase58(rawPublicKey)],
    ["hex", toHex(rawPublicKey)],
    ["hex with a scheme prefix", `00${toHex(rawPublicKey)}`],
  ])("reads a public key encoded as %s", (_, encoded) => {
    const { publicKey } = toSuiWallet(privyWallet(encoded))
    expect(publicKey.toSuiAddress()).toBe(address)
  })

  it("refuses a key that doesn't match the address", () => {
    const other = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(9))
    expect(() =>
      toSuiWallet(privyWallet(toBase58(other.getPublicKey().toRawBytes())))
    ).toThrow()
  })

  it("refuses a wallet with no public key", () => {
    expect(() =>
      toSuiWallet({ ...privyWallet(), publicKey: undefined })
    ).toThrow()
  })
})

describe("signing with raw signatures", () => {
  const bytes = new TextEncoder().encode("MemWal sponsor authorization")

  it("matches what Sui's own keypair produces for a personal message", async () => {
    const signature = await signPersonalMessage(wallet, bytes)
    expect(signature).toBe((await keypair.signPersonalMessage(bytes)).signature)
    const signer = await verifyPersonalMessageSignature(bytes, signature, {
      address,
    })
    expect(signer.toSuiAddress()).toBe(address)
  })

  it("matches what Sui's own keypair produces for a transaction", async () => {
    const signature = await signTransaction(wallet, bytes)
    expect(signature).toBe((await keypair.signTransaction(bytes)).signature)
    const signer = await verifyTransactionSignature(bytes, signature, {
      address,
    })
    expect(signer.toSuiAddress()).toBe(address)
  })
})

describe("deriveDelegateSeed", () => {
  it("gives a wallet the same seed every time", async () => {
    expect(toHex(await deriveDelegateSeed(wallet))).toBe(
      toHex(await deriveDelegateSeed(toSuiWallet(privyWallet())))
    )
  })

  it("gives different wallets different seeds", async () => {
    const other = {
      ...wallet,
      signRaw: vi.fn(async (data: Uint8Array) =>
        Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(9)).sign(data)
      ),
    }
    expect(toHex(await deriveDelegateSeed(other))).not.toBe(
      toHex(await deriveDelegateSeed(wallet))
    )
  })

  it("makes a 32-byte seed, which is what an Ed25519 key needs", async () => {
    expect(await deriveDelegateSeed(wallet)).toHaveLength(32)
  })
})
