import { describe, expect, it, vi } from "vitest"

import { proxyToWalrus, type WalrusProxyDeps } from "./walrus-proxy"

const ORIGIN = "http://app.test"
const RELAYER = "https://relayer.test"

function deps(overrides: Partial<WalrusProxyDeps> = {}): WalrusProxyDeps {
  return {
    relayerUrl: RELAYER,
    fetch: vi.fn(async () => Response.json({ ok: true })) as typeof fetch,
    now: () => 0,
    rateWindows: new Map(),
    ...overrides,
  }
}

function post(path: string, headers: Record<string, string> = {}, body = "{}") {
  return new Request(`${ORIGIN}/api/walrus/${path}`, {
    method: "POST",
    headers: {
      host: "app.test",
      origin: ORIGIN,
      "content-type": "application/json",
      ...headers,
    },
    body,
  })
}

function get(path: string, site = "same-origin") {
  return new Request(`${ORIGIN}/api/walrus/${path}`, {
    headers: { "sec-fetch-site": site },
  })
}

function forwarded(d: WalrusProxyDeps) {
  const [url, init] = vi.mocked(d.fetch).mock.calls[0]!
  return { url, init: init!, headers: init!.headers as Headers }
}

describe("proxyToWalrus", () => {
  it("forwards a signed request untouched, so its signature still holds", async () => {
    const d = deps()
    const response = await proxyToWalrus(
      post(
        "api/recall",
        {
          "x-public-key": "pub",
          "x-signature": "sig",
          "x-timestamp": "1",
          "x-nonce": "n",
          "x-account-id": "acc",
          "x-seal-session": "seal",
        },
        '{"query":"sleep"}'
      ),
      ["api", "recall"],
      d
    )

    expect(response.status).toBe(200)
    const { url, init, headers } = forwarded(d)
    expect(url).toBe(`${RELAYER}/api/recall`)
    expect(init.body).toBe('{"query":"sleep"}')
    for (const [name, value] of [
      ["x-public-key", "pub"],
      ["x-signature", "sig"],
      ["x-timestamp", "1"],
      ["x-nonce", "n"],
      ["x-account-id", "acc"],
      ["x-seal-session", "seal"],
    ]) {
      expect(headers.get(name!)).toBe(value)
    }
  })

  it("passes on nothing else the browser sent", async () => {
    const d = deps()
    await proxyToWalrus(
      post("api/recall", {
        cookie: "session=secret",
        authorization: "Bearer secret",
      }),
      ["api", "recall"],
      d
    )
    const { headers } = forwarded(d)
    expect(headers.get("cookie")).toBeNull()
    expect(headers.get("authorization")).toBeNull()
    expect(headers.get("origin")).toBeNull()
  })

  it("hands back the relayer's answer, including refusals", async () => {
    const d = deps({
      fetch: vi.fn(
        async () =>
          new Response('{"error":"nope"}', {
            status: 401,
            headers: {
              "content-type": "application/json",
              "x-auth-error": "clock_drift",
              "set-cookie": "tracker=1",
            },
          })
      ) as typeof fetch,
    })
    const response = await proxyToWalrus(
      post("api/recall"),
      ["api", "recall"],
      d
    )
    expect(response.status).toBe(401)
    expect(response.headers.get("x-auth-error")).toBe("clock_drift")
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(await response.text()).toBe('{"error":"nope"}')
  })

  it("allows only the routes this app uses", async () => {
    const d = deps()
    for (const path of [
      ["admin"],
      ["api", "restore"],
      ["api", "accounts", "0xabc", "delegate-keys"],
      ["..", "admin"],
    ]) {
      const response = await proxyToWalrus(post(path.join("/")), path, d)
      expect(response.status).toBe(404)
    }
    const wrongMethod = await proxyToWalrus(
      get("api/recall"),
      ["api", "recall"],
      d
    )
    expect(wrongMethod.status).toBe(404)
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it("reads an owner's public account lookup", async () => {
    const d = deps()
    const owner = `0x${"a".repeat(64)}`
    const response = await proxyToWalrus(
      get(`api/accounts/${owner}/delegate-keys`),
      ["api", "accounts", owner, "delegate-keys"],
      d
    )
    expect(response.status).toBe(200)
    expect(forwarded(d).url).toBe(
      `${RELAYER}/api/accounts/${owner}/delegate-keys`
    )
  })

  it("refuses other sites", async () => {
    const d = deps()
    const crossPost = await proxyToWalrus(
      post("sponsor", { origin: "https://evil.example" }),
      ["sponsor"],
      d
    )
    expect(crossPost.status).toBe(403)
    const crossGet = await proxyToWalrus(
      get("config", "cross-site"),
      ["config"],
      d
    )
    expect(crossGet.status).toBe(403)
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it("rejects oversized bodies and rate limits per client", async () => {
    const d = deps()
    const big = await proxyToWalrus(
      post("api/recall", {}, "x".repeat(70_000)),
      ["api", "recall"],
      d
    )
    expect(big.status).toBe(413)

    for (let i = 0; i < 119; i++) {
      await proxyToWalrus(post("sponsor"), ["sponsor"], d)
    }
    const limited = await proxyToWalrus(post("sponsor"), ["sponsor"], d)
    expect(limited.status).toBe(429)
  })

  it("hides network failures behind a generic error", async () => {
    const d = deps({
      fetch: vi.fn(async () => {
        throw new Error("secret detail")
      }) as typeof fetch,
    })
    const response = await proxyToWalrus(post("sponsor"), ["sponsor"], d)
    expect(response.status).toBe(502)
    expect(await response.text()).toBe("")
  })
})
