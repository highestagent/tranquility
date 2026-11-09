import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { z } from "zod"

import {
  discoverySchema,
  evidenceRequirementSchema,
  hypothesisSchema,
  investigationSchema,
} from "@/modules/memory/schemas"

/**
 * What Tranquility keeps in Walrus Memory. Findings share one namespace so they
 * can be searched by meaning. Everything that has to be read back exactly gets a
 * namespace of its own per revision, because recall ranks by similarity and
 * can't fetch a record by key. The inventory lists namespace names without
 * reading anything, so a device learns what's current from names alone.
 */

const timestamp = z.number().int().nonnegative()

export const findingRecord = discoverySchema
  .omit({ analysisIds: true })
  .extend({
    kind: z.literal("finding"),
    /** The hypothesis this finding answered, in words. */
    statement: z.string(),
  })

export const handoffRecord = z.object({
  kind: z.literal("handoff"),
  revision: timestamp,
  investigation: investigationSchema,
  hypotheses: z.array(hypothesisSchema),
  /** Paired sessions as counted where they were collected. */
  evidence: z.array(
    evidenceRequirementSchema
      .omit({ minPairs: true })
      .extend({ have: z.number().int().nonnegative(), need: z.number() })
  ),
  latestFinding: findingRecord.optional(),
})

/** A finding that no longer stands, wherever it was saved. */
export const withdrawalRecord = z.object({
  kind: z.literal("withdrawal"),
  id: z.string().min(1),
  at: timestamp,
  reason: z.string(),
})

export type FindingRecord = z.infer<typeof findingRecord>
export type HandoffRecord = z.infer<typeof handoffRecord>
export type WithdrawalRecord = z.infer<typeof withdrawalRecord>
export type MemoryRecord = FindingRecord | HandoffRecord | WithdrawalRecord

export interface Fact {
  /** Stable per record revision, so nothing is sent twice. */
  id: string
  /** Relative to the account's current prefix. */
  namespace: string
  text: string
}

/** Every saved finding, searchable by meaning. */
export const RESEARCH_NAMESPACE = "research"

/** Which Walrus memories this browser has sent. Kept per account. */
export const SYNC_STATE_KEY = "agentMemory:sync"
/** Handoffs this device took from another, by investigation. */
export const HANDOFFS_KEY = "agentMemory:handoffs"
/** Findings withdrawn on this device, until every device has heard. */
export const WITHDRAWALS_KEY = "agentMemory:withdrawals"
/** Findings the agent recalled recently, by Walrus blob. */
export const RECALLED_KEY = "agentMemory:recalled"

/** "Forget" moves to a new prefix, so nothing saved before is found again. */
export function memoryPrefix(epoch: number) {
  return `tranquility-${epoch}:`
}

/** Namespace names are visible metadata, so record IDs appear only hashed. */
export function opaqueId(id: string) {
  return bytesToHex(sha256(new TextEncoder().encode(id)))
}

export function encodeFact(record: MemoryRecord): Fact {
  const text = JSON.stringify(record)
  if (record.kind === "finding") {
    return { id: `finding:${record.id}`, namespace: RESEARCH_NAMESPACE, text }
  }
  if (record.kind === "withdrawal") {
    // The name alone says it's withdrawn, so no device has to read it.
    const namespace = `withdrawn:${opaqueId(record.id)}`
    return { id: namespace, namespace, text }
  }
  const { id, status } = record.investigation
  const namespace = `handoff:${opaqueId(id)}:${record.revision}:${status}`
  return { id: namespace, namespace, text }
}

export function readRecord<T>(schema: z.ZodType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Where one exact revision lives. */
export interface MemoryReference {
  namespace: string
  blobId: string
  revision: number
}

export interface HandoffReference extends MemoryReference {
  status: HandoffRecord["investigation"]["status"]
}

export interface Catalog {
  /** The newest handoff per investigation, keyed by its opaque ID. */
  handoffs: Map<string, HandoffReference>
  findings: number
  /** Opaque IDs of findings that no longer stand. */
  withdrawn: Set<string>
  /** Every full namespace name, to skip sending what's already there. */
  namespaces: Set<string>
}

const HANDOFF = /^handoff:([a-f0-9]{64}):(\d+):(active|paused|completed)$/
const WITHDRAWN = /^withdrawn:([a-f0-9]{64})$/

function newer(current: MemoryReference | undefined, next: MemoryReference) {
  if (!current) return true
  if (next.revision !== current.revision)
    return next.revision > current.revision
  // Same revision twice only happens on a retry. Any stable choice will do.
  return next.blobId > current.blobId
}

export function readCatalog(
  rows: readonly { namespace_id: string; blob_id: string }[],
  epoch: number
): Catalog {
  const prefix = memoryPrefix(epoch)
  const catalog: Catalog = {
    handoffs: new Map(),
    findings: 0,
    withdrawn: new Set(),
    namespaces: new Set(),
  }
  for (const row of rows) {
    if (!row.namespace_id.startsWith(prefix)) continue
    catalog.namespaces.add(row.namespace_id)
    const name = row.namespace_id.slice(prefix.length)
    if (name === RESEARCH_NAMESPACE) {
      catalog.findings++
      continue
    }
    const withdrawn = WITHDRAWN.exec(name)
    if (withdrawn) {
      catalog.withdrawn.add(withdrawn[1]!)
      continue
    }
    const handoff = HANDOFF.exec(name)
    if (!handoff) continue
    const [, key, version, status] = handoff
    const reference: HandoffReference = {
      namespace: row.namespace_id,
      blobId: row.blob_id,
      revision: Number(version),
      status: status as HandoffReference["status"],
    }
    if (!Number.isSafeInteger(reference.revision)) continue
    if (newer(catalog.handoffs.get(key!), reference)) {
      catalog.handoffs.set(key!, reference)
    }
  }
  return catalog
}

/** Whether a finding no longer stands, by this device's word or another's. */
export function withdrawnCheck(
  catalog: Pick<Catalog, "withdrawn">,
  local: readonly Pick<WithdrawalRecord, "id">[]
) {
  const here = new Set(local.map(({ id }) => id))
  return (findingId: string) =>
    here.has(findingId) || catalog.withdrawn.has(opaqueId(findingId))
}
