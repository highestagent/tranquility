import { discoveries, hypotheses, investigations, kv } from "@/modules/memory"

import { getMemoryUserId, memoryApi, type MemoryApi } from "./api"
import { distillFacts, type Fact } from "./distill"

/** Per network, since what's saved on one doesn't exist on another. */
const STATE_KEY = "agentMemory:mainnet"
const BATCH_SIZE = 10
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
    ...(await kv.get<Partial<MemoryState>>(STATE_KEY)),
  }
}

async function saveState(state: MemoryState) {
  await kv.set(STATE_KEY, state)
}

async function loadFacts(): Promise<Fact[]> {
  const [discoveryRows, hypothesisRows, investigationRows] = await Promise.all([
    discoveries.list(),
    hypotheses.list(),
    investigations.list(),
  ])
  return distillFacts({
    discoveries: discoveryRows,
    hypotheses: hypothesisRows,
    investigations: investigationRows,
  })
}

/**
 * One pass: settles finished jobs, then sends what's new. Everything it needs
 * is in storage, so a closed tab or lost connection only delays it. Returns
 * whether there's more to do soon.
 */
export async function runMemorySync(
  api: MemoryApi,
  owner: string,
  facts: readonly Fact[]
): Promise<{ more: boolean }> {
  const state = await getMemoryState()

  const epoch = await api.connect()

  // Another person signing in on this browser mustn't inherit these facts.
  if (
    (state.owner && state.owner !== owner) ||
    (state.epoch !== undefined && state.epoch !== epoch)
  ) {
    state.remembered = facts.map(({ id }) => id)
    state.pending = []
  }
  state.owner = owner
  state.epoch = epoch

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

  const known = new Set([
    ...state.remembered,
    ...state.pending.map((job) => job.factId),
  ])
  const unsent = facts.filter(({ id }) => !known.has(id))
  const batch = unsent.slice(0, BATCH_SIZE)
  if (batch.length > 0) {
    const { jobIds } = await api.remember(
      batch.map(({ text }) => text),
      epoch
    )
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
      const sync = async () => {
        if (owner !== getMemoryUserId()) return { more: false }
        const facts = await loadFacts()
        if (owner !== getMemoryUserId()) return { more: false }
        return runMemorySync(memoryApi, owner, facts)
      }
      const { more } = await withMemoryLock(sync)
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

/** How many memories the signed-in account holds across devices. */
export async function getSavedCount() {
  return memoryApi.count()
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
      const state = await getMemoryState()
      const facts = await loadFacts()
      await saveState({
        ...state,
        epoch,
        remembered: facts.map(({ id }) => id),
        pending: [],
        lastSavedAt: undefined,
      })
    })
  })().finally(() => {
    forgetting = null
  })
  return forgetting
}
