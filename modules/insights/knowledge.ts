import { THRESHOLDS } from "@/modules/analytics"
import { ASSESSMENTS, getAssessment } from "@/modules/assessments"
import {
  analyses as analysesRepo,
  hypotheses as hypothesesRepo,
  measurements as measurementsRepo,
  responses as responsesRepo,
  type Analysis,
  type Hypothesis,
  type Measurement,
  type QuestionResponse,
} from "@/modules/memory"
import {
  DOMAINS,
  getDomain,
  getQuestion,
  type QuestionDomain,
} from "@/modules/questionnaire"

export type LinkState =
  | "supported"
  | "refuted"
  | "testing"
  | "signal"
  | "inconclusive"
  | "hint"

export interface KnowledgeLink {
  domain: QuestionDomain
  assessmentId: string
  state: LinkState
  /** -1 to 1, or `null` if nothing has been measured yet. */
  effect: number | null
  /** Whether more of this factor goes with better performance. */
  helps: boolean | null
  title: string
}

export interface KnowledgeNode {
  id: string
  count: number
  /** 0 to 1: how close this node is to having enough data to test. */
  filled: number
}

export interface Knowledge {
  factors: KnowledgeNode[]
  abilities: KnowledgeNode[]
  links: KnowledgeLink[]
}

const RANK: Record<LinkState, number> = {
  supported: 6,
  refuted: 5,
  testing: 4,
  signal: 3,
  inconclusive: 2,
  hint: 1,
}

const STATE_WORDS: Record<LinkState, string> = {
  supported: "supported",
  refuted: "not supported",
  testing: "being tested",
  signal: "a signal",
  inconclusive: "unclear",
  hint: "a faint hint",
}

function latestAnalysis(
  analyses: readonly Analysis[],
  factorId: string,
  metric: Analysis["metric"]
) {
  return analyses
    .filter(
      (analysis) =>
        analysis.factorId === factorId &&
        analysis.metric.assessmentId === metric.assessmentId &&
        analysis.metric.metricId === metric.metricId
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

function helpsFrom(metric: Analysis["metric"], effect: number | null) {
  if (effect === null || effect === 0) return null
  const definition = getAssessment(metric.assessmentId)?.metrics.find(
    ({ id }) => id === metric.metricId
  )
  if (!definition) return null
  return effect > 0 === definition.higherIsBetter
}

function stateFromHypothesis(status: Hypothesis["status"]): LinkState | null {
  switch (status) {
    case "supported":
      return "supported"
    case "refuted":
      return "refuted"
    case "inconclusive":
      return "inconclusive"
    case "proposed":
    case "testing":
      return "testing"
    case "rejected":
      return null
  }
}

function stateFromAnalysis(analysis: Analysis): LinkState | null {
  if (analysis.grade === "contradictory") return "inconclusive"
  if (analysis.direction === "none") return null
  if (analysis.grade === "moderate" || analysis.grade === "strong") return "signal"
  return analysis.grade === "weak" ? "hint" : null
}

/** Turns stored evidence into the map. Only real records ever draw a thread. */
export function buildKnowledge(input: {
  responses: readonly QuestionResponse[]
  measurements: readonly Measurement[]
  analyses: readonly Analysis[]
  hypotheses: readonly Hypothesis[]
}): Knowledge {
  const links = new Map<string, KnowledgeLink>()

  function consider(
    factorId: string,
    metric: Analysis["metric"],
    state: LinkState,
    analysis: Analysis | undefined
  ) {
    const domain = getQuestion(factorId)?.domain
    const assessment = getAssessment(metric.assessmentId)
    if (!domain || !assessment) return
    const key = `${domain}|${metric.assessmentId}`
    const effect = analysis?.effect ?? null
    const existing = links.get(key)
    const better =
      !existing ||
      RANK[state] > RANK[existing.state] ||
      (RANK[state] === RANK[existing.state] &&
        Math.abs(effect ?? 0) > Math.abs(existing.effect ?? 0))
    if (!better) return
    links.set(key, {
      domain,
      assessmentId: metric.assessmentId,
      state,
      effect,
      helps: helpsFrom(metric, effect),
      title: `${getDomain(domain).label} and ${assessment.shortName}: ${STATE_WORDS[state]}`,
    })
  }

  for (const hypothesis of input.hypotheses) {
    const state = stateFromHypothesis(hypothesis.status)
    if (!state) continue
    consider(
      hypothesis.factorId,
      hypothesis.metric,
      state,
      latestAnalysis(input.analyses, hypothesis.factorId, hypothesis.metric)
    )
  }
  for (const analysis of input.analyses) {
    const latest = latestAnalysis(input.analyses, analysis.factorId, analysis.metric)
    if (latest?.id !== analysis.id) continue
    const state = stateFromAnalysis(analysis)
    if (state) consider(analysis.factorId, analysis.metric, state, analysis)
  }

  const fill = (count: number) => Math.min(1, count / THRESHOLDS.minPairs)
  const sessionsByDomain = new Map<QuestionDomain, Set<string>>()
  for (const response of input.responses) {
    const domain = getQuestion(response.questionId)?.domain
    if (!domain || response.value === null) continue
    const sessions = sessionsByDomain.get(domain) ?? new Set<string>()
    sessions.add(response.sessionId)
    sessionsByDomain.set(domain, sessions)
  }

  return {
    factors: DOMAINS.map(({ id }) => {
      const count = sessionsByDomain.get(id)?.size ?? 0
      return { id, count, filled: fill(count) }
    }),
    abilities: ASSESSMENTS.map(({ id }) => {
      const count = input.measurements.filter(
        (run) => run.assessmentId === id && run.valid
      ).length
      return { id, count, filled: fill(count) }
    }),
    links: [...links.values()],
  }
}

export async function loadKnowledge() {
  const [responses, measurements, analyses, hypotheses] = await Promise.all([
    responsesRepo.list(),
    measurementsRepo.list(),
    analysesRepo.list(),
    hypothesesRepo.list(),
  ])
  return buildKnowledge({ responses, measurements, analyses, hypotheses })
}
