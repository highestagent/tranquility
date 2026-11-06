import { describe, expect, it, vi } from "vitest"

import { handleMemoryRequest, type MemoryDeps } from "./server"

const ORIGIN = "http://app.test"

function request(headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/memory/x`, {
    method: "POST",
    headers: {
      host: "app.test",
      origin: ORIGIN,
      authorization: "Bearer good-token",
      ...headers,
    },
  })
}

function deps(overrides: Partial<MemoryDeps> = {}): MemoryDeps {
  const epochs = new Map<string, number>()
  return {
    // The token is the identity here, so tests can act as different people.
    verifyToken: async (token) => {
      if (token === "bad") throw new Error("invalid")
      return token === "good-token" ? "user-a" : token
    },
    getEpoch: async (userId) => epochs.get(userId) ?? 0,
    setEpoch: async (userId, epoch) => void epochs.set(userId, epoch),
    now: () => 0,
    rateWindows: new Map(),
    ...overrides,
  }
}

async function epochOf(d: MemoryDeps, token = "good-token") {
  const response = await handleMemoryRequest(
    request({ authorization: `Bearer ${token}` }),
    "info",
    d
  )
  expect(response.status).toBe(200)
  return ((await response.json()) as { epoch: number }).epoch
}

describe("handleMemoryRequest", () => {
  it("moves a person to a new epoch when they forget", async () => {
    const d = deps()
    expect(await epochOf(d)).toBe(0)
    const response = await handleMemoryRequest(request(), "forget", d)
    expect(await response.json()).toEqual({ epoch: 1 })
    expect(await epochOf(d)).toBe(1)
  })

  it("only moves the person who asked", async () => {
    const d = deps()
    await handleMemoryRequest(
      request({ authorization: "Bearer user-a" }),
      "forget",
      d
    )
    expect(await epochOf(d, "user-b")).toBe(0)
  })

  it("refuses missing or invalid tokens", async () => {
    const d = deps()
    const headers = new Headers(request().headers)
    headers.delete("authorization")
    const none = await handleMemoryRequest(
      new Request(`${ORIGIN}/x`, { method: "POST", headers }),
      "info",
      d
    )
    expect(none.status).toBe(401)
    const bad = await handleMemoryRequest(
      request({ authorization: "Bearer bad" }),
      "info",
      d
    )
    expect(bad.status).toBe(401)
  })

  it("refuses other origins and unknown actions", async () => {
    const d = deps()
    const crossOrigin = await handleMemoryRequest(
      request({ origin: "https://evil.example" }),
      "info",
      d
    )
    expect(crossOrigin.status).toBe(403)
    for (const action of ["recall", "remember", "drop"]) {
      const response = await handleMemoryRequest(request(), action, d)
      expect(response.status).toBe(404)
    }
  })

  it("rate limits per person", async () => {
    const d = deps()
    for (let i = 0; i < 60; i++) await epochOf(d)
    const limited = await handleMemoryRequest(request(), "info", d)
    expect(limited.status).toBe(429)
    expect(await epochOf(d, "user-b")).toBe(0)
  })

  it("hides storage failures behind a generic error", async () => {
    const d = deps({
      getEpoch: vi.fn(async () => {
        throw new Error("secret detail")
      }),
    })
    const response = await handleMemoryRequest(request(), "info", d)
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain("secret")
  })
})
