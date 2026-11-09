import { kv } from "@/modules/memory"

import { RECALLED_KEY, type FindingRecord } from "./records"

const KEEP = 30

/**
 * A finding the agent recalled, kept with its Walrus reference so the app can
 * show which saved note informed an answer.
 */
export interface RecalledNote extends Pick<
  FindingRecord,
  "statement" | "observed" | "verdict" | "grade" | "uncertainty" | "createdAt"
> {
  /** The Walrus blob it was read from. */
  reference: string
  findingId: string
  recalledAt: number
}

type Notes = Record<string, RecalledNote>

/** The key-value store, as open in someone else's transaction. */
export interface KvStore {
  get(key: string): Promise<{ key: string; value: unknown } | undefined>
  put(row: { key: string; value: unknown }): Promise<unknown>
}

export async function getRecalledNote(reference: string) {
  return (await kv.get<Notes>(RECALLED_KEY))?.[reference] ?? null
}

export async function keepRecalledNotes(notes: readonly RecalledNote[]) {
  if (notes.length === 0) return
  const kept = { ...(await kv.get<Notes>(RECALLED_KEY)) }
  for (const note of notes) kept[note.reference] = note
  const newest = Object.values(kept)
    .sort((a, b) => b.recalledAt - a.recalledAt)
    .slice(0, KEEP)
  await kv.set(
    RECALLED_KEY,
    Object.fromEntries(newest.map((note) => [note.reference, note]))
  )
}

/** Forgets recalled copies of findings that no longer stand. */
export async function dropRecalledNotes(
  isWithdrawn: (findingId: string) => boolean,
  store: KvStore = {
    get: async (key) => ({ key, value: await kv.get(key) }),
    put: ({ key, value }) => kv.set(key, value),
  }
) {
  const notes = (await store.get(RECALLED_KEY))?.value as Notes | undefined
  if (!notes) return false
  const kept = Object.values(notes).filter(
    ({ findingId }) => !isWithdrawn(findingId)
  )
  if (kept.length === Object.keys(notes).length) return false
  await store.put({
    key: RECALLED_KEY,
    value: Object.fromEntries(kept.map((note) => [note.reference, note])),
  })
  return true
}
