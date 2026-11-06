import "fake-indexeddb/auto"

import { sponsorAuthorizationMessage } from "@mysten-incubation/memwal"
import {
  addDelegateKey,
  createAccount,
} from "@mysten-incubation/memwal/account"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { fromBase64, toBase64, toHex } from "@mysten/sui/utils"
import {
  verifyPersonalMessageSignature,
  verifyTransactionSignature,
} from "@mysten/sui/verify"
import { deleteDB } from "idb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { closeDb, kv } from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import { connectMemoryAccount, sponsoredSigner } from "./provision"
import { deriveDelegateSeed, type SuiWallet } from "./wallet"

vi.mock("@mysten-incubation/memwal/account", () => ({
  createAccount: vi.fn(async () => ({ accountId: "0xnew" })),
  addDelegateKey: vi.fn(async () => ({ digest: "d" })),
}))

const RELAYER = "http://app.test/api/walrus"
const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7))
const address = keypair.getPublicKey().toSuiAddress()
const wallet: SuiWallet = {
  address,
  publicKey: keypair.getPublicKey(),
  signRaw: (bytes) => keypair.sign(bytes),
}

async function delegatePublicKey() {
  const seed = await deriveDelegateSeed(wallet)
  return toHex(Ed25519Keypair.fromSecretKey(seed).getPublicKey().toRawBytes())
}

/** A relayer with whatever this owner already has on chain. */
function stubRelayer(onChain: {
  account_id: string | null
  keys: { public_key: string }[]
}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/delegate-keys")) return Response.json(onChain)
    if (url.endsWith("/config")) {
      return Response.json({
        packageId: "0xpackage",
        registryId: "0xregistry",
        network: "mainnet",
        suiGrpcUrl: "http://sui.test",
      })
    }
    return new Response(null, { status: 500 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(async () => {
  closeDb()
  await deleteDB(DB_NAME)
  vi.clearAllMocks()
})

describe("connectMemoryAccount", () => {
  it("creates an account and registers the key for someone new", async () => {
    stubRelayer({ account_id: null, keys: [] })
    const { accountId, key } = await connectMemoryAccount(wallet, RELAYER)

    expect(accountId).toBe("0xnew")
    expect(key).toBe(toHex(await deriveDelegateSeed(wallet)))
    expect(createAccount).toHaveBeenCalledOnce()
    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        packageId: "0xpackage",
        registryId: "0xregistry",
      })
    )
    expect(addDelegateKey).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "0xnew",
        publicKey: await delegatePublicKey(),
      })
    )
  })

  it("resumes when the account exists but the key was never added", async () => {
    stubRelayer({ account_id: "0xold", keys: [] })
    const { accountId } = await connectMemoryAccount(wallet, RELAYER)

    expect(accountId).toBe("0xold")
    expect(createAccount).not.toHaveBeenCalled()
    expect(addDelegateKey).toHaveBeenCalledOnce()
  })

  it("writes nothing on a new device, because the key is the same", async () => {
    stubRelayer({
      account_id: "0xold",
      keys: [{ public_key: await delegatePublicKey() }],
    })
    const { accountId } = await connectMemoryAccount(wallet, RELAYER)

    expect(accountId).toBe("0xold")
    expect(createAccount).not.toHaveBeenCalled()
    expect(addDelegateKey).not.toHaveBeenCalled()
  })

  it("skips the lookup once the account is known", async () => {
    stubRelayer({ account_id: null, keys: [] })
    await connectMemoryAccount(wallet, RELAYER)

    const fetchMock = stubRelayer({ account_id: null, keys: [] })
    const { accountId } = await connectMemoryAccount(wallet, RELAYER)
    expect(accountId).toBe("0xnew")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ignores an account saved for a different wallet", async () => {
    await kv.set("agentMemoryAccount:mainnet", {
      owner: "0xother",
      accountId: "0xa",
    })
    stubRelayer({ account_id: null, keys: [] })
    const { accountId } = await connectMemoryAccount(wallet, RELAYER)
    expect(accountId).toBe("0xnew")
  })

  it("never saves the key in local storage", async () => {
    stubRelayer({ account_id: null, keys: [] })
    const { key } = await connectMemoryAccount(wallet, RELAYER)
    const saved = await kv.get("agentMemoryAccount:mainnet")
    expect(saved).toEqual({ owner: address, accountId: "0xnew" })
    expect(JSON.stringify(saved)).not.toContain(key)
  })

  it("registers nothing if the wallet's signatures vary", async () => {
    stubRelayer({ account_id: null, keys: [] })
    let call = 0
    const varying: SuiWallet = {
      ...wallet,
      signRaw: async () => new Uint8Array(64).fill(call++),
    }
    await expect(connectMemoryAccount(varying, RELAYER)).rejects.toThrow(
      "deterministic"
    )
    expect(createAccount).not.toHaveBeenCalled()
    expect(addDelegateKey).not.toHaveBeenCalled()
    expect(await kv.get("agentMemoryAccount:mainnet")).toBeUndefined()
  })

  it("stops without saving if the chain write fails, so it can retry", async () => {
    stubRelayer({ account_id: null, keys: [] })
    vi.mocked(createAccount).mockRejectedValueOnce(new Error("sponsor down"))
    await expect(connectMemoryAccount(wallet, RELAYER)).rejects.toThrow()
    expect(await kv.get("agentMemoryAccount:mainnet")).toBeUndefined()
  })
})

describe("sponsoredSigner", () => {
  const kind = new TextEncoder().encode("create_account kind bytes")
  const sponsoredBytes = new TextEncoder().encode("sponsored transaction data")

  function stubSponsor() {
    const bodies: Record<string, Record<string, string & number>> = {}
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const route = url.replace(RELAYER, "")
        bodies[route] = JSON.parse(init!.body as string)
        return Response.json(
          route === "/sponsor"
            ? { bytes: toBase64(sponsoredBytes), digest: "sponsored-digest" }
            : { digest: "executed-digest" }
        )
      })
    )
    return bodies
  }

  it("pays with the sponsor and signs as the wallet", async () => {
    const bodies = stubSponsor()
    const build = vi.fn(async () => kind)
    const result = await sponsoredSigner(
      wallet,
      "sui-client",
      RELAYER
    ).signAndExecuteTransaction({ transaction: { build } })

    expect(result.digest).toBe("executed-digest")
    expect(build).toHaveBeenCalledWith({
      client: "sui-client",
      onlyTransactionKind: true,
    })

    const sponsor = bodies["/sponsor"]!
    expect(sponsor.sender).toBe(address)
    expect(fromBase64(sponsor.transactionBlockKindBytes!)).toEqual(kind)
    const signer = await verifyPersonalMessageSignature(
      new TextEncoder().encode(
        await sponsorAuthorizationMessage(
          address,
          kind,
          sponsor.authTimestamp!,
          sponsor.authNonce!
        )
      ),
      sponsor.authSignature!,
      { address }
    )
    expect(signer.toSuiAddress()).toBe(address)

    const execute = bodies["/sponsor/execute"]!
    expect(execute.digest).toBe("sponsored-digest")
    expect(execute.sender).toBe(address)
    await verifyTransactionSignature(sponsoredBytes, execute.signature!, {
      address,
    })
  })

  it("stops at a refusal rather than signing anything", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 502 }))
    )
    const signRaw = vi.fn(wallet.signRaw)
    await expect(
      sponsoredSigner(
        { ...wallet, signRaw },
        "sui-client",
        RELAYER
      ).signAndExecuteTransaction({
        transaction: { build: async () => kind },
      })
    ).rejects.toThrow("502")
    // Only the authorization was signed, never a transaction.
    expect(signRaw).toHaveBeenCalledOnce()
  })
})
