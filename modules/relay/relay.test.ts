import { describe, expect, it, vi } from "vitest"

import { AGENT_MODEL } from "./config"
import { relay, type RelayDeps } from "./relay"

const ORIGIN = "http://app.test"

function request(overrides: Record<string, string> = {}, body = "{}") {
  return new Request(`${ORIGIN}/api/ai/language-model`, {
    method: "POST",
    headers: {
      host: "app.test",
      origin: ORIGIN,
      "content-type": "application/json",
      authorization: "Bearer browser-value",
      cookie: "private=1",
      "ai-language-model-id": AGENT_MODEL,
      ...overrides,
    },
    body,
  })
}

function deps(overrides: Partial<RelayDeps> = {}): RelayDeps {
  return {
    apiKey: "server-key",
    fetch: vi.fn(async () => new Response("data: ok", { status: 200 })),
    now: () => 0,
    rateWindows: new Map(),
    ...overrides,
  }
}

describe("relay", () => {
  it("swaps in the server key and forwards only allowed headers", async () => {
    const d = deps()
    const response = await relay(request(), ["language-model"], d)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("data: ok")

    const [url, init] = vi.mocked(d.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toMatch(/\/language-model$/)
    const sent = init.headers as Headers
    expect(sent.get("authorization")).toBe("Bearer server-key")
    expect(sent.get("cookie")).toBeNull()
    expect(sent.get("ai-language-model-id")).toBe(AGENT_MODEL)
  })

  it("refuses other origins and missing origins", async () => {
    const d = deps()
    const cross = await relay(
      request({ origin: "https://evil.example" }),
      ["language-model"],
      d
    )
    expect(cross.status).toBe(403)
    const headers = new Headers(request().headers)
    headers.delete("origin")
    const none = await relay(
      new Request(`${ORIGIN}/api/ai/language-model`, {
        method: "POST",
        headers,
        body: "{}",
      }),
      ["language-model"],
      d
    )
    expect(none.status).toBe(403)
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it("refuses paths and models outside the allowlist", async () => {
    const d = deps()
    expect((await relay(request(), ["credits"], d)).status).toBe(404)
    expect(
      (
        await relay(
          request({ "ai-language-model-id": "openai/expensive" }),
          ["language-model"],
          d
        )
      ).status
    ).toBe(400)
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it("refuses oversized bodies", async () => {
    const d = deps()
    const big = "x".repeat(1024 * 1024 + 1)
    const response = await relay(request({}, big), ["language-model"], d)
    expect(response.status).toBe(413)
    expect(d.fetch).not.toHaveBeenCalled()
  })

  it("rate limits per client and recovers after the window", async () => {
    let time = 0
    const d = deps({ now: () => time })
    for (let i = 0; i < 60; i++) {
      expect((await relay(request(), ["language-model"], d)).status).toBe(200)
    }
    expect((await relay(request(), ["language-model"], d)).status).toBe(429)
    time = 60_000
    expect((await relay(request(), ["language-model"], d)).status).toBe(200)
  })

  it("reports a missing key or unreachable upstream clearly", async () => {
    expect(
      (await relay(request(), ["language-model"], deps({ apiKey: undefined })))
        .status
    ).toBe(503)
    const failing = deps({
      fetch: vi.fn(async () => {
        throw new Error("down")
      }),
    })
    expect((await relay(request(), ["language-model"], failing)).status).toBe(
      502
    )
  })
})
