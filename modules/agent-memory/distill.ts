import type { Discovery, Hypothesis, Investigation } from "@/modules/memory"

export interface Fact {
  /** Stable per fact, so nothing is saved twice. */
  id: string
  text: string
}

const MAX_FACT_CHARS = 1200

function day(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/** A short stable hash, so a changed note becomes a new fact. */
function shortHash(text: string) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Turns the agent's conclusions into facts worth carrying between sessions and
 * devices. This is code rather than the model's summary, and it uses conclusions
 * only: raw answers and game trials stay on the device, because the memory
 * service reads text in plaintext while it stores and searches it.
 */
export function distillFacts(input: {
  discoveries: readonly Discovery[]
  hypotheses: readonly Hypothesis[]
  investigations: readonly Investigation[]
}): Fact[] {
  const statements = new Map(
    input.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis.statement])
  )
  const facts: Fact[] = []

  for (const finding of input.discoveries) {
    const statement = statements.get(finding.hypothesisId)
    facts.push({
      id: `finding:${finding.id}`,
      text: [
        `Finding from ${day(finding.createdAt)}.`,
        statement ? `Hypothesis: ${statement}.` : null,
        `Verdict: ${finding.verdict}, on ${finding.grade} evidence.`,
        finding.observed,
        finding.evidence,
        `Still uncertain: ${finding.uncertainty}`,
        `Next: ${finding.nextStep}`,
      ]
        .filter(Boolean)
        .join(" "),
    })
  }

  for (const investigation of input.investigations) {
    if (!investigation.progressNote) continue
    facts.push({
      id: `progress:${investigation.id}:${shortHash(investigation.progressNote)}`,
      text: `Investigation "${investigation.title}" (${investigation.question}), ${investigation.status}, as of ${day(investigation.updatedAt)}: ${investigation.progressNote}`,
    })
  }

  for (const hypothesis of input.hypotheses) {
    if (hypothesis.status !== "rejected") continue
    const note = hypothesis.history.at(-1)?.note
    facts.push({
      id: `dropped:${hypothesis.id}`,
      text: `Dropped the hypothesis "${hypothesis.statement}" on ${day(hypothesis.updatedAt)}.${note ? ` Reason: ${note}` : ""}`,
    })
  }

  return facts.map((fact) => ({
    ...fact,
    text: fact.text.slice(0, MAX_FACT_CHARS),
  }))
}
