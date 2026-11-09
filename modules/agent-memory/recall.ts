import { memoryApi, type MemoryApi } from "./api"
import {
  findingRecord,
  readRecord,
  withdrawnCheck,
  type FindingRecord,
} from "./records"
import { listPreferences } from "./preferences"
import { keepRecalledNotes, type RecalledNote } from "./recalled"
import { waitForRestore } from "./sync"
import { getLocalWithdrawals } from "./withdrawals"

const SEARCH_LIMIT = 6
/**
 * On a new device the first turn waits for what other devices saved, so it
 * resumes instead of starting over. Connecting was measured at about 5.4s on
 * mainnet; restoring adds a listing and a read per investigation.
 */
const RESTORE_BUDGET_MS = 20_000
/** Without past research the agent still works, so it shouldn't wait long. */
const SEARCH_BUDGET_MS = 10_000

/** A saved finding, as the agent sees it. */
export interface PastFinding {
  /** The Walrus blob this came from. */
  reference: string
  date: string
  statement: string
  observed: string
  verdict: FindingRecord["verdict"]
  grade: FindingRecord["grade"]
  uncertainty: string
  /** Lower is a closer match to the question. */
  distance: number
}

export interface AgentMemory {
  /** False when other devices' work couldn't be loaded this turn. */
  available: boolean
  /** What the person asked to have remembered, kept apart from research. */
  preferences: { id: string; text: string }[]
  /** `null` when saved findings couldn't be searched this turn. */
  pastResearch: PastFinding[] | null
}

function day(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function withBudget<T>(work: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out")), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export async function searchPastResearch(
  query: string,
  limit: number,
  api: Pick<MemoryApi, "open"> = memoryApi
) {
  const [workspace, withdrawals] = await Promise.all([
    api.open(),
    getLocalWithdrawals(),
  ])
  // Checked against a fresh inventory, so a correction made on another device
  // is honored as soon as it's saved.
  // Nothing saved means nothing to search, and no relayer call for it.
  if (workspace.catalog.findings === 0) return []
  const isWithdrawn = withdrawnCheck(workspace.catalog, withdrawals)
  const seen = new Set<string>()
  const findings: PastFinding[] = []
  const notes: RecalledNote[] = []
  const recalledAt = Date.now()
  for (const hit of await workspace.search(query, limit)) {
    const record = readRecord(findingRecord, hit.text)
    // Retries can store a finding twice.
    if (!record || seen.has(record.id) || isWithdrawn(record.id)) continue
    seen.add(record.id)
    findings.push({
      reference: hit.blobId,
      date: day(record.createdAt),
      statement: record.statement,
      observed: record.observed,
      verdict: record.verdict,
      grade: record.grade,
      uncertainty: record.uncertainty,
      distance: hit.distance,
    })
    notes.push({
      reference: hit.blobId,
      findingId: record.id,
      recalledAt,
      createdAt: record.createdAt,
      statement: record.statement,
      observed: record.observed,
      verdict: record.verdict,
      grade: record.grade,
      uncertainty: record.uncertainty,
    })
  }
  await keepRecalledNotes(notes)
  return findings
}

/**
 * What the agent knows from past sessions, possibly on another device. Takes on
 * other devices' work first, then searches. A failure means less context this
 * turn, never a failed turn.
 */
export async function recallForAgent(
  query: () => Promise<string>
): Promise<AgentMemory> {
  const available = await waitForRestore(RESTORE_BUDGET_MS)
  // Preferences come from this device's copy, which restoring just refreshed.
  const preferences = (await listPreferences()).map(({ id, text }) => ({
    id,
    text,
  }))
  try {
    return {
      available,
      preferences,
      pastResearch: await withBudget(
        query().then((text) => searchPastResearch(text, SEARCH_LIMIT)),
        SEARCH_BUDGET_MS
      ),
    }
  } catch {
    return { available, preferences, pastResearch: null }
  }
}
