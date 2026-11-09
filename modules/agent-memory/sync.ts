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
  type LocalResearch,
  type RestoredHandoff,
} from "./distill"
import {
  handoffRecord,
  HANDOFFS_KEY,
  memoryPrefix,
  opaqueId,
  readRecord,
  RESEARCH_NAMESPACE,
  SYNC_STATE_KEY,
  type Fact,
  type HandoffRecord,
  type HandoffReference,
} from "./records"

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
  const [discoveryRows, hypothesisRows, investigationRows, restored] =
    await Promise.all([
      discoveries.list(),
      hypotheses.list(),
      investigations.list(),
      getRestoredHandoffs(),
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

/** Keeps the newer side of each hypothesis, with its full local history. */
function mergeHypothesis(local: Hypothesis | undefined, remote: Hypothesis) {
  if (!local) return remote
  if (local.updatedAt >= remote.updatedAt) return null
  const lastAt = local.history.at(-1)?.at ?? 0
  return {
    ...remote,
    history: [
      ...local.history,
      ...remote.history.filter((entry) => entry.at > lastAt),
    ],
  }
}

/** One transaction, so a half-applied plan can't be mistaken for current. */
async function applyHandoff(record: HandoffRecord) {
  const db = await getDb()
  const tx = db.transaction(["investigations", "hypotheses", "kv"], "readwrite")
  await tx.objectStore("investigations").put(record.investigation)
  for (const remote of record.hypotheses) {
    const store = tx.objectStore("hypotheses")
    const merged = mergeHypothesis(await store.get(remote.id), remote)
    if (merged) await store.put(merged)
  }
  const kvStore = tx.objectStore("kv")
  const restored =
    ((await kvStore.get(HANDOFFS_KEY))?.value as
      Record<string, RestoredHandoff> | undefined) ?? {}
  restored[record.investigation.id] = {
    revision: record.revision,
    evidence: record.evidence,
    latestFinding: record.latestFinding,
  }
  await kvStore.put({ key: HANDOFFS_KEY, value: restored })
  await tx.done
}

/**
 * Takes on whatever another device moved further: a plan to resume, a status
 * change. Completed investigations this device never saw stay out of the way;
 * their findings remain searchable.
 */
async function restoreHandoffs(workspace: MemoryWorkspace) {
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
  for (const record of records) if (record) await applyHandoff(record)
}

/** Forgotten, or another person's: this device's caches no longer apply. */
async function clearAccountCaches() {
  await kv.remove(HANDOFFS_KEY)
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
  options: { onRestored?: () => void } = {}
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

  await restoreHandoffs(workspace)
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
          ? runMemorySync(memoryApi, owner, { onRestored: markRestored })
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
export async function getSavedCount() {
  const { catalog } = await memoryApi.open()
  return catalog.findings + catalog.handoffs.size
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
