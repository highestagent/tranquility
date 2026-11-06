import { MemWalMock } from "@mysten-incubation/memwal"
import { describe, expect, it, vi } from "vitest"

import {
  handleMemoryRequest,
  namespaceFor,
  type MemoryClient,
  type MemoryDeps,
} from "./server"

const ORIGIN = "http://app.test"

function request(body: object, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/memory/x`, {
    method: "POST",
    headers: {
      host: "app.test",
      origin: ORIGIN,
      authorization: "Bearer good-token",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
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
    client: MemWalMock.create({
      namespace: "unused",
    }) as unknown as MemoryClient,
    now: () => 0,
    rateWindows: new Map(),
    ...overrides,
  }
}

async function remember(d: MemoryDeps, text: string, token = "good-token") {
  const response = await handleMemoryRequest(
    request({ items: [{ text }] }, { authorization: `Bearer ${token}` }),
    "remember",
    d
  )
  expect(response.status).toBe(200)
  return (await response.json()) as { jobIds: string[] }
}

async function recall(d: MemoryDeps, query: string, token = "good-token") {
  const response = await handleMemoryRequest(
    request({ query }, { authorization: `Bearer ${token}` }),
    "recall",
    d
  )
  expect(response.status).toBe(200)
  return (await response.json()) as { memories: { text: string }[] }
}

describe("handleMemoryRequest", () => {
  it("stores and recalls memories end to end", async () => {
    const d = deps()
    const { jobIds } = await remember(
      d,
      "More sleep goes with faster reactions"
    )
    expect(jobIds).toHaveLength(1)
    const { memories } = await recall(d, "sleep reactions")
    expect(memories[0]?.text).toContain("faster reactions")
  })

  it("keeps each person's memories apart", async () => {
    const d = deps()
    await remember(d, "Alice sleeps badly", "user-a")
    const { memories } = await recall(d, "sleeps badly", "user-b")
    expect(memories).toEqual([])
  })

  it("ignores any namespace a browser tries to name", async () => {
    const d = deps()
    await remember(d, "Alice sleeps badly", "user-a")
    const response = await handleMemoryRequest(
      request(
        { query: "sleeps badly", namespace: namespaceFor("user-a", 0) },
        { authorization: "Bearer user-b" }
      ),
      "recall",
      d
    )
    expect(
      ((await response.json()) as { memories: unknown[] }).memories
    ).toEqual([])
  })

  it("hides another person's job status", async () => {
    const d = deps()
    const { jobIds } = await remember(d, "Private", "user-a")
    const response = await handleMemoryRequest(
      request({ jobIds }, { authorization: "Bearer user-b" }),
      "status",
      d
    )
    const { jobs } = (await response.json()) as {
      jobs: { status: string }[]
    }
    expect(jobs[0]?.status).toBe("not_found")
  })

  it("forgets by moving to a new namespace", async () => {
    const d = deps()
    await remember(d, "Sleep matters")
    expect((await recall(d, "sleep")).memories).toHaveLength(1)

    const response = await handleMemoryRequest(request({}), "forget", d)
    expect(response.status).toBe(200)
    expect((await recall(d, "sleep")).memories).toEqual([])
  })

  it("refuses missing or invalid tokens", async () => {
    const d = deps()
    const headers = new Headers(request({}).headers)
    headers.delete("authorization")
    const none = await handleMemoryRequest(
      new Request(`${ORIGIN}/x`, { method: "POST", headers, body: "{}" }),
      "info",
      d
    )
    expect(none.status).toBe(401)
    const bad = await handleMemoryRequest(
      request({}, { authorization: "Bearer bad" }),
      "info",
      d
    )
    expect(bad.status).toBe(401)
  })

  it("refuses other origins and unknown actions", async () => {
    const d = deps()
    expect(
      (
        await handleMemoryRequest(
          request({}, { origin: "https://evil.example" }),
          "info",
          d
        )
      ).status
    ).toBe(403)
    expect((await handleMemoryRequest(request({}), "drop", d)).status).toBe(404)
  })

  it("rejects malformed and oversized input", async () => {
    const d = deps()
    const tooLong = await handleMemoryRequest(
      request({ items: [{ text: "x".repeat(1201) }] }),
      "remember",
      d
    )
    expect(tooLong.status).toBe(400)
    const tooBig = await handleMemoryRequest(
      request({ query: "x".repeat(70_000) }),
      "recall",
      d
    )
    expect(tooBig.status).toBe(413)
  })

  it("rate limits per person", async () => {
    const d = deps()
    for (let i = 0; i < 60; i++) {
      const ok = await handleMemoryRequest(request({}), "info", d)
      expect(ok.status).toBe(200)
    }
    expect((await handleMemoryRequest(request({}), "info", d)).status).toBe(429)
    const other = await handleMemoryRequest(
      request({}, { authorization: "Bearer user-b" }),
      "info",
      d
    )
    expect(other.status).toBe(200)
  })

  it("reports when Walrus Memory isn't set up", async () => {
    const d = deps({ client: null })
    const info = await handleMemoryRequest(request({}), "info", d)
    expect(await info.json()).toEqual({ configured: false })
    const recallResponse = await handleMemoryRequest(
      request({ query: "x" }),
      "recall",
      d
    )
    expect(recallResponse.status).toBe(503)
  })

  it("hides relayer failures behind a generic error", async () => {
    const d = deps({
      client: {
        rememberBulkAsync: vi.fn(),
        getRememberStatus: vi.fn(),
        recall: vi.fn(async () => {
          throw new Error("secret relayer detail")
        }),
      },
    })
    const response = await handleMemoryRequest(
      request({ query: "x" }),
      "recall",
      d
    )
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain("secret")
  })
})
