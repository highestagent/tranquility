import { countPairs } from "@/modules/analytics"
import {
  discoveries,
  hypotheses,
  investigations,
  kv,
  type Hypothesis,
} from "@/modules/memory"
import { getDb } from "@/modules/memory/db"

import {
  getMemoryUserId,
  memoryApi,
  type MemoryApi,
  type MemoryWorkspace,
} from "./api"
import {
  distillFacts,
  localRevision,
  planBasis,
  type LocalResearch,
  type RestoredHandoff,
} from "./distill"
import {
  handoffRecord,
  HANDOFFS_KEY,
  memoryPrefix,
  preferenceRecord,
  PREFERENCES_KEY,
  RECALLED_KEY,
  opaqueId,
  readRecord,
  RESEARCH_NAMESPACE,
  SYNC_STATE_KEY,
  withdrawnCheck,
  type Fact,
  type HandoffRecord,
  type HandoffReference,
} from "./records"
import { getPreferenceRevisions } from "./preferences"
import { dropRecalledNotes } from "./recalled"
import { getLocalWithdrawals } from "./withdrawals"

const BATCH_SIZE = 10
/** The proxy accepts 64 KB per request, and JSON escaping adds some. */
const BATCH_CHARS = 40_000
const READ_CONCURRENCY = 4
const CHECK_AGAIN_MS = 20_000
const IDLE_SYNC_MS = 60_000
const MAX_BACKOFF_MS = 10 * 60_000

export interface MemoryState {
  /** Who these memories belong to. */
  owner?: string
  epoch?: number
  /** Facts safely stored. Kept so nothing is ever sent twice. */
  remembered: string[]
  /** Facts the service accepted, and whose storage hasn't finished yet. */
  pending: { factId: string; jobId: string }[]
  lastSavedAt?: number
  /** The last attempt failed, so what's shown may be out of date. */
  failing?: boolean
}

export async function getMemoryState(): Promise<MemoryState> {
  return {
    remembered: [],
    pending: [],
    ...(await kv.get<Partial<MemoryState>>(SYNC_STATE_KEY)),
  }
}

async function saveState(state: MemoryState) {
  await kv.set(SYNC_STATE_KEY, state)
}

export async function getRestoredHandoffs() {
  return (await kv.get<Record<string, RestoredHandoff>>(HANDOFFS_KEY)) ?? {}
}

async function loadLocal(): Promise<LocalResearch> {
  const [
    discoveryRows,
    hypothesisRows,
    investigationRows,
    restored,
    withdrawals,
    preferences,
  ] = await Promise.all([
    discoveries.list(),
    hypotheses.list(),
    investigations.list(),
    getRestoredHandoffs(),
    getLocalWithdrawals(),
    getPreferenceRevisions(),
  ])
  const evidence = Object.fromEntries(
    await Promise.all(
      investigationRows
        .filter((row) => row.status !== "completed")
        .map(
          async (row) =>
            [
              row.id,
              await Promise.all(
                row.evidenceRequirements.map(
                  async ({ factorId, metric, minPairs }) => ({
                    factorId,
                    metric,
                    have: await countPairs(factorId, metric),
                    need: minPairs,
                  })
                )
              ),
            ] as const
        )
    )
  )
  return {
    discoveries: discoveryRows,
    hypotheses: hypothesisRows,
    investigations: investigationRows,
    evidence,
    restored,
    withdrawals,
    preferences,
  }
}

/** Runs `work` over `items`, a few at a time. */
async function inParallel<T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>
) {
  const results: R[] = []
  for (let i = 0; i < items.length; i += READ_CONCURRENCY) {
    results.push(
      ...(await Promise.all(items.slice(i, i + READ_CONCURRENCY).map(work)))
    )
  }
  return results
}

/**
 * The newer handoff wins as a whole, since comparing timestamps across devices
 * would trust whichever clock runs ahead. Local history is kept.
 */
function mergeHypothesis(local: Hypothesis | undefined, remote: Hypothesis) {
  if (!local) return remote
  const seen = new Set(local.history.map((entry) => JSON.stringify(entry)))
  return {
    ...remote,
    history: [
      ...local.history,
      ...remote.history.filter((entry) => !seen.has(JSON.stringify(entry))),
    ],
  }
}

type IsWithdrawn = (findingId: string) => boolean

/** One transaction, so a half-applied plan can't be mistaken for current. */
async function applyHandoff(record: HandoffRecord, isWithdrawn: IsWithdrawn) {
  const db = await getDb()
  const tx = db.transaction(
    ["investigations", "hypotheses", "discoveries", "kv"],
    "readwrite"
  )
  const { id } = record.investigation
  await tx.objectStore("investigations").put(record.investigation)
  const hypothesisStore = tx.objectStore("hypotheses")
  for (const remote of record.hypotheses) {
    await hypothesisStore.put(
      mergeHypothesis(await hypothesisStore.get(remote.id), remote)
    )
  }
  const latestLocal = (
    await tx.objectStore("discoveries").index("byInvestigation").getAll(id)
  ).sort((a, b) => b.createdAt - a.createdAt)[0]

  const kvStore = tx.objectStore("kv")
  const restored =
    ((await kvStore.get(HANDOFFS_KEY))?.value as
      Record<string, RestoredHandoff> | undefined) ?? {}
  restored[id] = {
    revision: record.revision,
    // From the plan as received: if this device's copy differs after merging,
    // it has something to add and hands it back.
    basis: planBasis(record.investigation, record.hypotheses, latestLocal?.id),
    evidence: record.evidence,
    // A device that hasn't heard of a correction yet can still hand it over.
    latestFinding:
      record.latestFinding && !isWithdrawn(record.latestFinding.id)
        ? record.latestFinding
        : undefined,
  }
  await kvStore.put({ key: HANDOFFS_KEY, value: restored })
  await tx.done
}

/**
 * Takes on whatever another device moved further: a plan to resume, a status
 * change. Completed investigations this device never saw stay out of the way;
 * their findings remain searchable.
 */
async function restoreHandoffs(
  workspace: MemoryWorkspace,
  isWithdrawn: IsWithdrawn
) {
  const local = await loadLocal()
  const byKey = new Map(
    local.investigations.map((row) => [opaqueId(row.id), row])
  )
  const stale: [string, HandoffReference][] = []
  for (const [key, reference] of workspace.catalog.handoffs) {
    const mine = byKey.get(key)
    if (!mine && reference.status === "completed") continue
    if (reference.revision > (mine ? localRevision(mine, local) : -1)) {
      stale.push([key, reference])
    }
  }
  const records = await inParallel(stale, async ([key, reference]) => {
    const record = readRecord(handoffRecord, await workspace.read(reference))
    // The namespace vouches for which investigation and revision this is.
    return record &&
      opaqueId(record.investigation.id) === key &&
      record.revision === reference.revision
      ? record
      : null
  })
  let changed = false
  for (const record of records) {
    if (!record) continue
    await applyHandoff(record, isWithdrawn)
    changed = true
  }
  return changed
}

/**
 * Drops findings another device withdrew. This device never holds another's
 * findings as its own, except through an imported backup, but a result carried
 * over with a handoff has to go too.
 */
async function applyWithdrawals(workspace: MemoryWorkspace) {
  const { withdrawn } = workspace.catalog
  if (withdrawn.size === 0) return false
  let changed = false
  for (const finding of await discoveries.list()) {
    if (!withdrawn.has(opaqueId(finding.id))) continue
    await discoveries.remove(finding.id)
    changed = true
  }
  const restored = await getRestoredHandoffs()
  for (const handoff of Object.values(restored)) {
    if (
      handoff.latestFinding &&
      withdrawn.has(opaqueId(handoff.latestFinding.id))
    ) {
      delete handoff.latestFinding
      changed = true
    }
  }
  if (changed) await kv.set(HANDOFFS_KEY, restored)
  const dropped = await dropRecalledNotes((id) => withdrawn.has(opaqueId(id)))
  return changed || dropped
}

/** Takes on newer preference edits and removals from other devices. */
async function restorePreferences(workspace: MemoryWorkspace) {
  const local = await getPreferenceRevisions()
  const byKey = new Map(Object.keys(local).map((id) => [opaqueId(id), id]))
  const stale = [...workspace.catalog.preferences].filter(
    ([key, reference]) => {
      const id = byKey.get(key)
      return reference.revision > (id ? local[id]!.revision : -1)
    }
  )
  if (stale.length === 0) return false
  const records = await inParallel(stale, async ([key, reference]) => {
    const record = readRecord(preferenceRecord, await workspace.read(reference))
    return record &&
      opaqueId(record.id) === key &&
      record.revision === reference.revision
      ? record
      : null
  })
  // Re-read, so an edit made here while reading isn't overwritten.
  const latest = await getPreferenceRevisions()
  let changed = false
  for (const record of records) {
    if (!record || (latest[record.id]?.revision ?? -1) >= record.revision)
      continue
    latest[record.id] = { revision: record.revision, text: record.text }
    changed = true
  }
  if (changed) await kv.set(PREFERENCES_KEY, latest)
  return changed
}

/** Forgotten, or another person's: this device's caches no longer apply. */
async function clearAccountCaches() {
  await kv.remove(HANDOFFS_KEY)
  await kv.remove(RECALLED_KEY)
  await kv.remove(PREFERENCES_KEY)
}

function isAlreadyStored(fact: Fact, workspace: MemoryWorkspace) {
  return (
    fact.namespace !== RESEARCH_NAMESPACE &&
    workspace.catalog.namespaces.has(
      `${memoryPrefix(workspace.epoch)}${fact.namespace}`
    )
  )
}

function nextBatch(facts: readonly Fact[]) {
  const batch: Fact[] = []
  let chars = 0
  for (const fact of facts) {
    if (batch.length === BATCH_SIZE) break
    if (batch.length > 0 && chars + fact.text.length > BATCH_CHARS) break
    batch.push(fact)
    chars += fact.text.length
  }
  return batch
}

/**
 * One pass: takes on what other devices saved, settles finished jobs, then
 * sends what's new. Everything it needs is in storage, so a closed tab or lost
 * connection only delays it. Returns whether there's more to do soon.
 */
export async function runMemorySync(
  api: MemoryApi,
  owner: string,
  options: {
    /** Other devices' work is now on this one. */
    onRestored?: () => void
    /** What this device shows changed because of another device. */
    onChanged?: () => void
  } = {}
): Promise<{ more: boolean }> {
  const state = await getMemoryState()
  const workspace = await api.open()
  const { epoch } = workspace

  // After a forget, or for someone else's account, nothing here goes up again
  // unless it changes.
  if (
    (state.owner && state.owner !== owner) ||
    (state.epoch !== undefined && state.epoch !== epoch)
  ) {
    await clearAccountCaches()
    state.remembered = distillFacts(await loadLocal()).map(({ id }) => id)
    state.pending = []
    state.lastSavedAt = undefined
  }
  state.owner = owner
  state.epoch = epoch
  await saveState(state)

  const isWithdrawn = withdrawnCheck(
    workspace.catalog,
    await getLocalWithdrawals()
  )
  const restored = await restoreHandoffs(workspace, isWithdrawn)
  const withdrawn = await applyWithdrawals(workspace)
  const preferred = await restorePreferences(workspace)
  if (restored || withdrawn || preferred) options.onChanged?.()
  options.onRestored?.()

  if (state.pending.length > 0) {
    const { jobs } = await api.status(state.pending.map((job) => job.jobId))
    const statusOf = new Map(jobs.map((job) => [job.jobId, job.status]))
    const stillRunning: MemoryState["pending"] = []
    for (const job of state.pending) {
      const status = statusOf.get(job.jobId)
      if (status === "done") {
        state.remembered.push(job.factId)
        state.lastSavedAt = Date.now()
      } else if (
        status === "pending" ||
        status === "running" ||
        status === "uploaded"
      ) {
        stillRunning.push(job)
      }
      // Failed or unknown jobs drop out here, so the fact is sent again below.
    }
    state.pending = stillRunning
    await saveState(state)
  }

  const facts = distillFacts(await loadLocal())
  const current = new Set(facts.map(({ id }) => id))
  const known = new Set([
    // What no longer exists locally can't be produced again, so it's dropped.
    ...state.remembered.filter((id) => current.has(id)),
    ...facts
      .filter((fact) => isAlreadyStored(fact, workspace))
      .map(({ id }) => id),
  ])
  state.remembered = [...known]
  for (const job of state.pending) known.add(job.factId)

  const unsent = facts.filter(({ id }) => !known.has(id))
  const batch = nextBatch(unsent)
  if (batch.length > 0) {
    const { jobIds } = await api.remember(batch, epoch)
    batch.forEach((fact, index) => {
      const jobId = jobIds[index]
      if (jobId) state.pending.push({ factId: fact.id, jobId })
    })
  }
  state.failing = false
  await saveState(state)
  if (batch.length && state.pending.length === 0)
    throw new Error("Walrus Memory accepted no jobs")
  return { more: state.pending.length > 0 || unsent.length > batch.length }
}

let running: Promise<void> | null = null
let forgetting: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let failures = 0
let restored = false
const restoreWaiters = new Set<() => void>()
const changeListeners = new Set<() => void>()

/** Calls `listener` whenever another device's work changes what's shown here. */
export function onMemoryChange(listener: () => void) {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

function notifyChanged() {
  for (const listener of changeListeners) listener()
}

function markRestored() {
  restored = true
  for (const resolve of restoreWaiters) resolve()
  restoreWaiters.clear()
}

function withMemoryLock<T>(work: () => Promise<T>) {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks
  return locks ? locks.request("tranquility-memory-sync", work) : work()
}

function scheduleAgain(delay: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void syncMemory(), delay)
}

/**
 * The background task. Safe to call at any time and from anywhere: it never
 * throws and never blocks. Its first run creates the person's wallet and Walrus
 * Memory account if they don't have them, and it retries by itself, backing off
 * while anything is unreachable.
 */
export function syncMemory(): Promise<void> {
  if (forgetting) return forgetting.catch(() => undefined)
  running ??= (async () => {
    const owner = getMemoryUserId()
    if (!owner) return

    try {
      const { more } = await withMemoryLock(async () =>
        owner === getMemoryUserId()
          ? runMemorySync(memoryApi, owner, {
              onRestored: markRestored,
              onChanged: notifyChanged,
            })
          : { more: false }
      )
      failures = 0
      if (owner === getMemoryUserId())
        scheduleAgain(more ? CHECK_AGAIN_MS : IDLE_SYNC_MS)
    } catch (error) {
      if (owner === getMemoryUserId()) {
        console.warn("Agent memory couldn't sync:", error)
        failures++
        scheduleAgain(Math.min(CHECK_AGAIN_MS * 2 ** failures, MAX_BACKOFF_MS))
        await saveState({ ...(await getMemoryState()), failing: true })
      }
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      running = null
    })
  return running
}

/**
 * Resolves true once this visit has taken on what other devices saved, so the
 * agent doesn't start over on a new device. False if no one is signed in, the
 * attempt failed, or it took too long.
 */
export async function waitForRestore(timeoutMs: number): Promise<boolean> {
  if (restored) return true
  if (!getMemoryUserId()) return false
  let done = () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    new Promise<void>((resolve) => {
      done = resolve
      restoreWaiters.add(resolve)
    }),
    // A pass that ends without restoring has failed, so stop waiting.
    syncMemory(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs)
    }),
  ])
  clearTimeout(timer)
  restoreWaiters.delete(done)
  return restored
}

/** What the signed-in account holds across devices. */
export interface MemoryOverview {
  investigations: {
    id: string
    title: string
    status: string
    synced: boolean
  }[]
  /** Saved findings, counting ones since withdrawn. */
  findings: number
  withdrawn: number
  preferences: { id: string; text: string; synced: boolean }[]
}

/** What's synced, for review: compares this device's records with the inventory. */
export async function getMemoryOverview(
  api: Pick<MemoryApi, "open"> = memoryApi
): Promise<MemoryOverview> {
  const [{ catalog }, local] = await Promise.all([api.open(), loadLocal()])
  return {
    investigations: [...local.investigations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        synced:
          (catalog.handoffs.get(opaqueId(row.id))?.revision ?? -1) >=
          localRevision(row, local),
      })),
    findings: catalog.findings,
    withdrawn: catalog.withdrawn.size,
    preferences: Object.entries(local.preferences)
      .flatMap(([id, { revision, text }]) =>
        text === null
          ? []
          : [
              {
                id,
                text,
                revision,
                synced:
                  (catalog.preferences.get(opaqueId(id))?.revision ?? -1) >=
                  revision,
              },
            ]
      )
      .sort((a, b) => b.revision - a.revision)
      .map(({ id, text, synced }) => ({ id, text, synced })),
  }
}

/**
 * Stops the agent recalling anything saved so far. Local records stay marked as
 * sent, so they aren't saved again unless they change.
 */
export function forgetMemories() {
  forgetting ??= (async () => {
    await running
    await withMemoryLock(async () => {
      const epoch = await memoryApi.forget()
      await clearAccountCaches()
      const state = await getMemoryState()
      await saveState({
        ...state,
        epoch,
        remembered: distillFacts(await loadLocal()).map(({ id }) => id),
        pending: [],
        lastSavedAt: undefined,
      })
    })
  })().finally(() => {
    forgetting = null
  })
  return forgetting
}
