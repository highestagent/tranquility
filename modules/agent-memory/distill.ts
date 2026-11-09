import type { Discovery, Hypothesis, Investigation } from "@/modules/memory"

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

export interface LocalResearch {
  discoveries: readonly Discovery[]
  hypotheses: readonly Hypothesis[]
  investigations: readonly Investigation[]
  /** Paired sessions per investigation, as counted on this device. */
  evidence: Readonly<Record<string, HandoffRecord["evidence"]>>
  restored: Readonly<Record<string, RestoredHandoff>>
  /** Findings this device withdrew. Other devices' are applied before this runs. */
  withdrawals: readonly WithdrawalRecord[]
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
  // A result from another device carries forward until this one has its own.
  const carried = input.restored[investigation.id]?.latestFinding
  const latestFinding =
    byRecent(
      findings.filter((row) => row.investigationId === investigation.id),
      (row) => row.createdAt
    )[0] ??
    (carried && !input.withdrawals.some(({ id }) => id === carried.id)
      ? carried
      : undefined)
  const revision = handoffRevision(investigation, plan, latestFinding)
  return { plan, latestFinding, revision }
}

/** The newest revision this device holds, whether made here or restored. */
export function localRevision(
  investigation: Investigation,
  input: LocalResearch
) {
  return Math.max(
    describe(investigation, input, findingRecords(input)).revision,
    input.restored[investigation.id]?.revision ?? -1
  )
}

function handoffFor(
  investigation: Investigation,
  input: LocalResearch,
  findings: readonly FindingRecord[]
): Fact | null {
  const { plan, latestFinding, revision } = describe(
    investigation,
    input,
    findings
  )
  const restored = input.restored[investigation.id]
  if (restored && revision <= restored.revision) return null

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
    ...handoffs,
    ...findings.map(encodeFact),
  ]
}
