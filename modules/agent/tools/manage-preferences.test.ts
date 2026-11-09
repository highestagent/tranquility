import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { beforeEach, describe, expect, it } from "vitest"

import { listPreferences } from "@/modules/agent-memory/preferences"
import { closeDb } from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import { managePreferences } from "./manage-preferences"

function run(
  input: Omit<
    Parameters<NonNullable<typeof managePreferences.execute>>[0],
    "reason"
  >
) {
  return managePreferences.execute!({ reason: "The user asked", ...input }, {
    toolCallId: "t",
    messages: [],
  } as never)
}

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("managePreferences", () => {
  it("remembers, corrects, and forgets what the user asks in chat", async () => {
    const saved = (await run({
      action: "remember",
      text: "Mornings work best for check-ins",
    })) as { preferenceId: string }
    await run({
      action: "change",
      preferenceId: saved.preferenceId,
      text: "Evenings work best for check-ins",
    })
    expect((await listPreferences()).map(({ text }) => text)).toEqual([
      "Evenings work best for check-ins",
    ])

    await run({ action: "forget", preferenceId: saved.preferenceId })
    expect(await listPreferences()).toEqual([])
  })

  it("won't change or forget a preference that doesn't exist", async () => {
    await expect(
      run({ action: "forget", preferenceId: "made-up" })
    ).rejects.toThrow(/memory.preferences/)
    await expect(run({ action: "remember" })).rejects.toThrow(/text/)
  })
})
