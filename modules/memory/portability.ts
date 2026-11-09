import { z } from "zod"

import { getDb, LOCAL_OWNER_KEY, STORE_NAMES, type StoreName } from "./db"
import {
  analysisSchema,
  decisionSchema,
  discoverySchema,
  hypothesisSchema,
  investigationSchema,
  kvSchema,
  measurementSchema,
  responseSchema,
  sessionSchema,
} from "./schemas"

export const EXPORT_FORMAT = "tranquility-export"
export const EXPORT_VERSION = 1

const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.number(),
  data: z.object({
    sessions: z.array(sessionSchema),
    measurements: z.array(measurementSchema),
    responses: z.array(responseSchema),
    investigations: z.array(investigationSchema),
    hypotheses: z.array(hypothesisSchema),
    analyses: z.array(analysisSchema),
    discoveries: z.array(discoverySchema),
    decisions: z.array(decisionSchema),
    kv: z.array(kvSchema),
  }),
})

export type TranquilityExport = z.infer<typeof exportSchema>

/** Which account and sync progress this browser holds. Never exported or imported. */
function isAccountMetadata(key: string) {
  return (
    key === LOCAL_OWNER_KEY ||
    key === "agentMemory:sync" ||
    key === "agentMemoryAccount:mainnet"
  )
}

export async function exportAll(): Promise<TranquilityExport> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAMES, "readonly")
  const [
    sessions,
    measurements,
    responses,
    investigations,
    hypotheses,
    analyses,
    discoveries,
    decisions,
    kv,
  ] = await Promise.all([
    tx.objectStore("sessions").getAll(),
    tx.objectStore("measurements").getAll(),
    tx.objectStore("responses").getAll(),
    tx.objectStore("investigations").getAll(),
    tx.objectStore("hypotheses").getAll(),
    tx.objectStore("analyses").getAll(),
    tx.objectStore("discoveries").getAll(),
    tx.objectStore("decisions").getAll(),
    tx.objectStore("kv").getAll(),
  ])
  await tx.done
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    data: {
      sessions,
      measurements,
      responses,
      investigations,
      hypotheses,
      analyses,
      discoveries,
      decisions,
      kv: kv.filter(({ key }) => !isAccountMetadata(key)),
    },
  }
}

export class InvalidImportError extends Error {}

/**
 * Replaces everything on this device with the file's contents. The file is
 * fully validated first and the write is one transaction, so a bad file or a
 * failed write leaves existing data untouched.
 */
export async function importAll(input: unknown): Promise<void> {
  const parsed = exportSchema.safeParse(input)
  if (!parsed.success) {
    throw new InvalidImportError("This file is not a valid Tranquility export.")
  }
  const db = await getDb()
  const tx = db.transaction(STORE_NAMES, "readwrite")
  const work: Promise<unknown>[] = []
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name)
    if (name === "kv") {
      for (const key of await tx.objectStore("kv").getAllKeys()) {
        if (!isAccountMetadata(key)) work.push(tx.objectStore("kv").delete(key))
      }
    } else {
      work.push(store.clear())
    }
    for (const row of parsed.data.data[name]) {
      if (name !== "kv" || !("key" in row) || !isAccountMetadata(row.key)) {
        work.push(store.put(row as never))
      }
    }
  }
  work.push(tx.done)
  await Promise.all(work)
}

export async function deleteAll(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAMES, "readwrite")
  const keys = await tx.objectStore("kv").getAllKeys()
  await Promise.all([
    ...STORE_NAMES.filter((name) => name !== "kv").map((name) =>
      tx.objectStore(name).clear()
    ),
    ...keys
      .filter((key) => !isAccountMetadata(key))
      .map((key) => tx.objectStore("kv").delete(key)),
    tx.done,
  ])
}

export async function countAll(): Promise<Record<StoreName, number>> {
  const db = await getDb()
  const entries = await Promise.all(
    STORE_NAMES.map(async (name) => [name, await db.count(name)] as const)
  )
  return Object.fromEntries(entries) as Record<StoreName, number>
}
