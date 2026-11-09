import type { z } from "zod"

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
  waitForMemoryAccount,
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
  type MemoryReference,
} from "./records"
import { getPreferenceRevisions } from "./preferences"
import { dropRecalledNotes } from "./recalled"
import { getLocalWithdrawals } from "./withdrawals"

const BATCH_SIZE = 10
/** The proxy accepts 64 KB per request, and JSON escaping adds some. */
const BATCH_CHARS = 40_000
const READ_CONCURRENCY = 4
/**
 * The relayer allows each account 500 points an hour: 10 per upload and 1 for
 * anything else. The agent changes its plan almost every turn, so syncing
 * every change as it happens would spend that within a busy hour.
 */
/** How often running uploads are checked on. */
const CHECK_AGAIN_MS = 30_000
/** How often other devices' work is looked for while the app is in view. */
const IDLE_SYNC_MS = 5 * 60_000
/**
 * Routine changes wait this long after the last upload, so one upload carries
 * several plan revisions. Leaving the page or the agent resting sends them now.
 */
export const ROUTINE_UPLOAD_GAP_MS = 5 * 60_000
/** Focusing the window doesn't start another pass if one just ran. */
const OPPORTUNISTIC_GAP_MS = 30_000
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
  /** When the last upload was sent, to space routine ones out. */
  lastUploadAt?: number
  /** More is waiting from the last upload's backlog, so it goes without a gap. */
  backlog?: boolean
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

/**
 * Reads exact revisions and checks each is the record its name says. One
 * unreadable blob mustn't stop everything else syncing, so failures come back
 * as `failed` instead of throwing.
 */
async function readExact<T extends { revision: number }>(
  workspace: MemoryWorkspace,
  stale: readonly [string, MemoryReference][],
  schema: z.ZodType<T>,
  keyOf: (record: T) => string
) {
  let failed = false
  const records = await inParallel(stale, async ([key, reference]) => {
    try {
      const record = readRecord(schema, await workspace.read(reference))
      // The namespace vouches for which record and revision this is.
      return record &&
        opaqueId(keyOf(record)) === key &&
        record.revision === reference.revision
        ? record
        : null
    } catch {
      failed = true
      return null
    }
  })
  return { records: records.filter((record) => record !== null), failed }
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
  const { records, failed } = await readExact(
    workspace,
    stale,
    handoffRecord,
    (record) => record.investigation.id
  )
  for (const record of records) await applyHandoff(record, isWithdrawn)
  return { changed: records.length > 0, complete: !failed }
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
  if (stale.length === 0) return { changed: false, complete: true }
  const { records, failed } = await readExact(
    workspace,
    stale,
    preferenceRecord,
    (record) => record.id
  )
  // Re-read, so an edit made here while reading isn't overwritten.
  const latest = await getPreferenceRevisions()
  let changed = false
  for (const record of records) {
    if ((latest[record.id]?.revision ?? -1) >= record.revision) continue
    latest[record.id] = { revision: record.revision, text: record.text }
    changed = true
  }
  if (changed) await kv.set(PREFERENCES_KEY, latest)
  return { changed, complete: !failed }
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

/**
 * Withdrawals can't wait, since a stale finding is worse than a slow one, and
 * preferences are something the person just asked for. Anything else rides
 * along with them.
 */
function isUrgent({ namespace }: Fact) {
  return (
    namespace.startsWith("withdrawn:") || namespace.startsWith("preference:")
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
    /** What this device shows, or what's synced, changed. */
    onChanged?: () => void
    /** What the account held when the pass began. */
    onOpened?: (workspace: MemoryWorkspace) => void
    /** Send routine changes now instead of waiting out the gap. */
    flush?: boolean
  } = {}
): Promise<{ more: boolean; deferredMs?: number }> {
  const state = await getMemoryState()
  const workspace = await api.open()
  options.onOpened?.(workspace)
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
  const plans = await restoreHandoffs(workspace, isWithdrawn)
  const withdrawn = await applyWithdrawals(workspace)
  const preferences = await restorePreferences(workspace)
  if (plans.changed || withdrawn || preferences.changed) options.onChanged?.()
  // Only a full restore lets a new device's agent carry on as if it knew it all.
  if (plans.complete && preferences.complete) options.onRestored?.()

  let saved = false
  if (state.pending.length > 0) {
    const { jobs } = await api.status(state.pending.map((job) => job.jobId))
    const statusOf = new Map(jobs.map((job) => [job.jobId, job.status]))
    const stillRunning: MemoryState["pending"] = []
    for (const job of state.pending) {
      const status = statusOf.get(job.jobId)
      if (status === "done") {
        state.remembered.push(job.factId)
        state.lastSavedAt = Date.now()
        saved = true
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
    if (saved) options.onChanged?.()
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
  const now = Date.now()
  const nextRoutineAt =
    state.lastUploadAt === undefined
      ? now
      : state.lastUploadAt + ROUTINE_UPLOAD_GAP_MS
  const due =
    options.flush ||
    state.backlog ||
    now >= nextRoutineAt ||
    unsent.some(isUrgent)
  const batch = due
    ? nextBatch([
        ...unsent.filter(isUrgent),
        ...unsent.filter((fact) => !isUrgent(fact)),
      ])
    : []
  if (batch.length > 0) {
    const { jobIds } = await api.remember(batch, epoch)
    batch.forEach((fact, index) => {
      const jobId = jobIds[index]
      if (jobId) state.pending.push({ factId: fact.id, jobId })
    })
    state.lastUploadAt = now
    state.backlog = unsent.length > batch.length
  }
  state.failing = false
  await saveState(state)
  if (batch.length && state.pending.length === 0)
    throw new Error("Walrus Memory accepted no jobs")
  return {
    more: state.pending.length > 0 || Boolean(state.backlog),
    deferredMs:
      !due && unsent.length > 0 ? Math.max(0, nextRoutineAt - now) : undefined,
  }
}

let running: Promise<void> | null = null
let forgetting: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let failures = 0
let restored = false
let lastPassAt = 0
/** Asked for while a pass was running, so another one follows it. */
let queued: { flush: boolean } | null = null
/** What the account held at the latest pass, so a view needn't ask again. */
let lastOpened: { workspace: MemoryWorkspace; at: number } | null = null
const restoreWaiters = new Set<() => void>()
const changeListeners = new Set<() => void>()
const passListeners = new Set<() => void>()

/** Calls `listener` when another device's work arrives or a save finishes. */
export function onMemoryChange(listener: () => void) {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

/** Calls `listener` after every pass, whatever it did. */
export function onSyncPass(listener: () => void) {
  passListeners.add(listener)
  return () => {
    passListeners.delete(listener)
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

function isHidden() {
  return (
    typeof document !== "undefined" && document.visibilityState === "hidden"
  )
}

/** Nothing runs on a timer while the page is hidden. Coming back syncs. */
function scheduleAgain(delay: number) {
  if (timer) clearTimeout(timer)
  timer = null
  if (!isHidden()) timer = setTimeout(() => void syncMemory(), delay)
}

export interface SyncRequest {
  /** Send routine changes now: the person is leaving, or the agent rested. */
  flush?: boolean
  /** Prompted by focus or reconnecting rather than by a change. */
  opportunistic?: boolean
}

/**
 * The background task. Safe to call at any time and from anywhere: it never
 * throws and never blocks. Its first run creates the person's wallet and Walrus
 * Memory account if they don't have them, and it retries by itself, backing off
 * while anything is unreachable.
 */
export function syncMemory(request: SyncRequest = {}): Promise<void> {
  if (forgetting) return forgetting.catch(() => undefined)
  if (running) {
    // It may have read this device's records before the change that prompted
    // this, so run once more after it.
    if (!request.opportunistic) {
      queued = { flush: Boolean(queued?.flush || request.flush) }
    }
    return running
  }
  if (
    request.opportunistic &&
    !request.flush &&
    Date.now() - lastPassAt < OPPORTUNISTIC_GAP_MS
  ) {
    return Promise.resolve()
  }
  running = (async () => {
    const owner = getMemoryUserId()
    if (!owner) return

    try {
      const { more, deferredMs } = await withMemoryLock(async () =>
        owner === getMemoryUserId()
          ? runMemorySync(memoryApi, owner, {
              onRestored: markRestored,
              onChanged: notifyChanged,
              onOpened: (workspace) => {
                lastOpened = { workspace, at: Date.now() }
              },
              flush: request.flush,
            })
          : { more: false, deferredMs: undefined }
      )
      failures = 0
      if (owner === getMemoryUserId())
        scheduleAgain(
          more
            ? CHECK_AGAIN_MS
            : Math.min(deferredMs ?? IDLE_SYNC_MS, IDLE_SYNC_MS)
        )
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
      lastPassAt = Date.now()
      for (const listener of passListeners) listener()
      const next = queued
      queued = null
      if (next) void syncMemory(next)
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
  // A returning visit opens before Privy confirms the session.
  await waitForMemoryAccount(timeoutMs)
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
/** The latest pass's listing is recent enough to show without asking again. */
const COUNT_MAX_AGE_MS = 2 * 60_000

/**
 * How many things the agent remembers across devices: investigations,
 * findings that still stand, and preferences.
 */
export async function getMemoryCount(api: Pick<MemoryApi, "open"> = memoryApi) {
  // A pass that's already running lists the account anyway, so wait for it.
  if (running) await running
  const fresh =
    lastOpened && Date.now() - lastOpened.at < COUNT_MAX_AGE_MS
      ? lastOpened.workspace
      : null
  const [{ catalog }, preferences] = await Promise.all([
    fresh ?? api.open(),
    getPreferenceRevisions(),
  ])
  return (
    catalog.handoffs.size +
    Math.max(0, catalog.findings - catalog.withdrawn.size) +
    Object.values(preferences).filter(({ text }) => text !== null).length
  )
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
