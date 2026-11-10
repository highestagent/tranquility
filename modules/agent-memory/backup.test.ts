import { describe, expect, it } from "vitest"

import {
  CHUNK_CHARS,
  CHUNKS_PER_PART,
  isBackedUpKey,
  joinBackup,
  openBackup,
  sealBackup,
  toBackupFacts,
  type BackupPayload,
} from "./backup"

function walletKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ])
}

const payload: BackupPayload = {
  version: 1,
  createdAt: 1,
  device: "0123456789abcdef",
  data: {
    sessions: [{ id: "s1", startedAt: 1 }],
    measurements: [],
    responses: [
      {
        id: "r1",
        sessionId: "s1",
        questionId: "sleep.hours",
        bankVersion: 1,
        value: 7,
        answeredAt: 1,
      },
    ],
    investigations: [],
    hypotheses: [],
    analyses: [],
    discoveries: [],
    decisions: [],
    kv: [],
  },
}

describe("backups", () => {
  it("round-trips, and reveals nothing without the key", async () => {
    const key = await walletKey()
    const sealed = await sealBackup(payload, key)
    expect(sealed).not.toContain("sleep")
    expect(atob(sealed)).not.toContain("sleep.hours")
    expect(await openBackup(sealed, key)).toEqual(payload)
    await expect(openBackup(sealed, await walletKey())).rejects.toThrow()
  })

  it("never seals the same backup the same way twice", async () => {
    const key = await walletKey()
    expect(await sealBackup(payload, key)).not.toBe(
      await sealBackup(payload, key)
    )
  })

  it("splits into chunks the relayer embeds as they are, in parts recall can read", () => {
    const sealed = "x".repeat(CHUNK_CHARS * (CHUNKS_PER_PART + 2) + 10)
    const facts = toBackupFacts("0123456789abcdef", 5, sealed)
    expect(facts).toHaveLength(CHUNKS_PER_PART + 3)
    expect(new Set(facts.map(({ id }) => id)).size).toBe(facts.length)
    for (const { text } of facts) {
      expect(new TextEncoder().encode(text).length).toBeLessThan(8 * 1024)
    }
    expect(facts[0]?.namespace).toBe(
      `backup:0123456789abcdef:5:0:2:${CHUNKS_PER_PART}`
    )
    expect(facts.at(-1)?.namespace).toBe("backup:0123456789abcdef:5:1:2:3")
  })

  it("reassembles chunks in any order, but not with one missing", () => {
    const sealed = "a".repeat(CHUNK_CHARS) + "b".repeat(CHUNK_CHARS) + "c"
    const texts = toBackupFacts("0123456789abcdef", 5, sealed).map(
      ({ text }) => text
    )
    const shuffled = [texts[2]!, texts[0]!, texts[1]!, texts[0]!]
    expect(joinBackup(shuffled, 3)).toBe(sealed)
    expect(() => joinBackup([texts[0]!, texts[2]!], 3)).toThrow()
  })

  it("keeps research context and leaves this device's own state behind", () => {
    for (const key of [
      "contextAnswers",
      "seenDiscoveriesAt",
      "sessionSummary:s1",
      "correction:r1:5",
    ]) {
      expect(isBackedUpKey(key)).toBe(true)
    }
    for (const key of [
      "agentRest",
      "pendingTask",
      "aiConsent",
      "sessionNotifications",
      "agentMemory:sync",
      "localAccountOwner",
    ]) {
      expect(isBackedUpKey(key)).toBe(false)
    }
  })
})
