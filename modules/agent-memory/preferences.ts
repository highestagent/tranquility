import { kv, newId } from "@/modules/memory"

import {
  MAX_PREFERENCE_CHARS,
  PREFERENCES_KEY,
  type PreferenceRecord,
} from "./records"

/** Every preference this device knows, removed ones included, by ID. */
export type PreferenceRevisions = Record<
  string,
  Pick<PreferenceRecord, "revision" | "text">
>

export interface Preference {
  id: string
  text: string
  revision: number
}

export async function getPreferenceRevisions(): Promise<PreferenceRevisions> {
  return (await kv.get<PreferenceRevisions>(PREFERENCES_KEY)) ?? {}
}

/** What the person asked to have remembered, newest first. */
export async function listPreferences(): Promise<Preference[]> {
  return Object.entries(await getPreferenceRevisions())
    .flatMap(([id, { revision, text }]) =>
      text === null ? [] : [{ id, text, revision }]
    )
    .sort((a, b) => b.revision - a.revision)
}

export class InvalidPreferenceError extends Error {}

/** Each change is a new revision, so the newest wins on every device. */
async function write(id: string, text: string | null) {
  const all = await getPreferenceRevisions()
  const revision = Math.max(Date.now(), (all[id]?.revision ?? -1) + 1)
  all[id] = { revision, text }
  await kv.set(PREFERENCES_KEY, all)
  // Imported here rather than at the top, since sync reads preferences from here.
  void import("./sync").then(({ syncMemory }) => syncMemory())
  return revision
}

function clean(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_PREFERENCE_CHARS) {
    throw new InvalidPreferenceError(
      `Keep it between 1 and ${MAX_PREFERENCE_CHARS} characters.`
    )
  }
  return trimmed
}

/** Saves a new preference, or replaces the text of an existing one. */
export async function savePreference(
  text: string,
  id: string = newId()
): Promise<Preference> {
  const cleaned = clean(text)
  return { id, text: cleaned, revision: await write(id, cleaned) }
}

export async function removePreference(id: string) {
  await write(id, null)
}
