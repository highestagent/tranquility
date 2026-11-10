import { afterEach, describe, expect, it, vi } from "vitest"

import { verifyWalrusAccount } from "./tatum"

const { getObject } = vi.hoisted(() => ({ getObject: vi.fn() }))
vi.mock("@mysten/sui/grpc", () => ({
  SuiGrpcClient: class {
    ledgerService = { getObject }
  },
}))

const WALLET = "0x" + "a".repeat(64)
const ACCOUNT = "0x" + "b".repeat(64)
const PACKAGE = "0x" + "c".repeat(64)
const TYPE = PACKAGE + "::account::MemWalAccount"

function walrusLookup(accountId: string | null = ACCOUNT) {
  const fetch = vi.fn(async (url: string) =>
    Response.json(
      url.endsWith("/config")
        ? { network: "mainnet", packageId: PACKAGE }
        : { account_id: accountId }
    )
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function tatumObject({
  accountId = ACCOUNT,
  owner = WALLET,
  type = TYPE,
  active = true,
}: {
  accountId?: string
  owner?: string
  type?: string
  active?: boolean
} = {}) {
  getObject.mockResolvedValue({
    response: {
      object: {
        objectId: accountId,
        objectType: type,
        json: {
          kind: {
            oneofKind: "structValue",
            structValue: {
              fields: {
                owner: {
                  kind: { oneofKind: "stringValue", stringValue: owner },
                },
                active: { kind: { oneofKind: "boolValue", boolValue: active } },
              },
            },
          },
        },
      },
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  getObject.mockReset()
})

describe("verifyWalrusAccount", () => {
  it("verifies the active mainnet account for the linked wallet through Tatum", async () => {
    const fetch = walrusLookup()
    tatumObject()
    const signal = new AbortController().signal

    await expect(
      verifyWalrusAccount(WALLET, "test-key", signal)
    ).resolves.toEqual({ status: "verified", accountId: ACCOUNT })
    expect(fetch).toHaveBeenCalledWith(
      "https://relayer.memory.walrus.xyz/api/accounts/" +
        WALLET +
        "/delegate-keys",
      { cache: "no-store", signal }
    )
    expect(getObject).toHaveBeenCalledWith(
      {
        objectId: ACCOUNT,
        readMask: { paths: ["object_id", "object_type", "json"] },
      },
      { meta: { "x-api-key": "test-key" }, abort: signal }
    )
  })

  it.each([
    { owner: ACCOUNT },
    { accountId: WALLET },
    { type: PACKAGE + "::other::Object" },
    { active: false },
  ])("rejects a mismatched or inactive account (%j)", async (fields) => {
    walrusLookup()
    tatumObject(fields)

    await expect(
      verifyWalrusAccount(WALLET, "test-key", new AbortController().signal)
    ).resolves.toEqual({ status: "mismatch" })
  })

  it("waits for provisioning when the relayer has no account", async () => {
    walrusLookup(null)

    await expect(
      verifyWalrusAccount(WALLET, "test-key", new AbortController().signal)
    ).resolves.toEqual({ status: "not_ready" })
    expect(getObject).not.toHaveBeenCalled()
  })
})
