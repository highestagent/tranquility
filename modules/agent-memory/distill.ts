import type { Discovery, Hypothesis, Investigation } from "@/modules/memory"

import type { PreferenceRevisions } from "./preferences"
import {
  encodeFact,
  type Fact,
  type FindingRecord,
  type HandoffRecord,
  type WithdrawalRecord,
} from "./records"

/** Keeps a bulk request under the proxy's body limit. */
export const MAX_FACT_CHARS = 6000

/** A handoff this device took from another, and what came with it. */
export interface RestoredHandoff {
  revision: number
  /** The local plan right after restoring, to tell when it changes here. */
  basis: string
  evidence: HandoffRecord["evidence"]
  latestFinding?: FindingRecord
}

/**
 * A finding's conclusions only. Raw answers and game trials stay on the device,
 * because Walrus Memory reads text in plaintext while it stores and searches it.
 */
export function toFindingRecord(
  finding: Discovery,
  statement = ""
): FindingRecord {
  return {
    kind: "finding",
    statement: statement.slice(0, 300),
    observed: finding.observed.slice(0, 500),
    verdict: finding.verdict,
    grade: finding.grade,
    uncertainty: finding.uncertainty.slice(0, 400),
    evidence: finding.evidence.slice(0, 700),
    reliability: finding.reliability.slice(0, 300),
    nextStep: finding.nextStep.slice(0, 400),
    createdAt: finding.createdAt,
    id: finding.id,
    investigationId: finding.investigationId,
    hypothesisId: finding.hypothesisId,
  }
}

/** Newest first. */
function byRecent<T>(rows: readonly T[], at: (row: T) => number) {
  return [...rows].sort((a, b) => at(b) - at(a))
}

/** Any change to the plan or its latest result makes a new revision. */
export function handoffRevision(
  investigation: Investigation,
  plan: readonly Hypothesis[],
  latestFinding: FindingRecord | undefined
) {
  return Math.max(
    investigation.updatedAt,
    latestFinding?.createdAt ?? 0,
    ...plan.map((row) => row.updatedAt)
  )
}

/**
 * What the plan looks like on this device. Comparing this, not timestamps,
 * tells whether it changed since it was restored, since devices' clocks differ.
 */
export function planBasis(
  investigation: Pick<Investigation, "status" | "updatedAt">,
  plan: readonly Pick<Hypothesis, "id" | "updatedAt">[],
  latestLocalFindingId: string | undefined
) {
  return JSON.stringify([
    investigation.status,
    investigation.updatedAt,
    plan.map(({ id, updatedAt }) => `${id}:${updatedAt}`).sort(),
    latestLocalFindingId ?? null,
  ])
}

export interface LocalResearch {
  discoveries: readonly Discovery[]
  hypotheses: readonly Hypothesis[]
  investigations: readonly Investigation[]
  /** Paired sessions per investigation, as counted on this device. */
  evidence: Readonly<Record<string, HandoffRecord["evidence"]>>
  restored: Readonly<Record<string, RestoredHandoff>>
  /** Findings this device withdrew. Other devices' are applied before this runs. */
  withdrawals: readonly WithdrawalRecord[]
  preferences: PreferenceRevisions
}

function findingRecords(input: LocalResearch) {
  const statements = new Map(
    input.hypotheses.map((row) => [row.id, row.statement])
  )
  return input.discoveries.map((finding) =>
    toFindingRecord(finding, statements.get(finding.hypothesisId))
  )
}

/** The investigation as this device would hand it off now. */
function describe(
  investigation: Investigation,
  input: LocalResearch,
  findings: readonly FindingRecord[]
) {
  const plan = byRecent(
    input.hypotheses.filter((row) => row.investigationId === investigation.id),
    (row) => row.updatedAt
  )
  const restored = input.restored[investigation.id]
  const latestLocal = byRecent(
    findings.filter((row) => row.investigationId === investigation.id),
    (row) => row.createdAt
  )[0]
  // A result from another device carries forward until this one has its own.
  const carried = restored?.latestFinding
  const latestFinding =
    latestLocal ??
    (carried && !input.withdrawals.some(({ id }) => id === carried.id)
      ? carried
      : undefined)
  const unchanged =
    restored?.basis === planBasis(investigation, plan, latestLocal?.id)
  const own = handoffRevision(investigation, plan, latestFinding)
  // A change made here always outranks what it was restored from, even if
  // this device's clock is behind.
  const revision = !restored
    ? own
    : unchanged
      ? restored.revision
      : Math.max(own, restored.revision + 1)
  return { plan, latestFinding, revision, unchanged }
}

/** The revision of the plan this device holds, whether made here or restored. */
export function localRevision(
  investigation: Investigation,
  input: LocalResearch
) {
  return describe(investigation, input, findingRecords(input)).revision
}

function handoffFor(
  investigation: Investigation,
  input: LocalResearch,
  findings: readonly FindingRecord[]
): Fact | null {
  const { plan, latestFinding, revision, unchanged } = describe(
    investigation,
    input,
    findings
  )
  // Taking on another device's plan isn't news to hand back.
  if (unchanged) return null

  // The newest hypotheses matter most, so the oldest go first if it's too long.
  for (let keep = plan.length; keep >= 0; keep--) {
    const fact = encodeFact({
      kind: "handoff",
      revision,
      investigation,
      hypotheses: plan
        .slice(0, keep)
        .map((row) => ({ ...row, history: row.history.slice(-1) })),
      evidence: input.evidence[investigation.id] ?? [],
      latestFinding,
    })
    if (fact.text.length <= MAX_FACT_CHARS) return fact
  }
  return null
}

/** What this device has to contribute to the account's memory. */
export function distillFacts(input: LocalResearch): Fact[] {
  const findings = findingRecords(input)
  const handoffs = input.investigations.flatMap(
    (investigation) => handoffFor(investigation, input, findings) ?? []
  )
  // Withdrawals go first: a stale finding is worse than a missing one.
  return [
    ...input.withdrawals.map(encodeFact),
    ...Object.entries(input.preferences).map(([id, { revision, text }]) =>
      encodeFact({ kind: "preference", id, revision, text })
    ),
    ...handoffs,
    ...findings.map(encodeFact),
  ]
}
