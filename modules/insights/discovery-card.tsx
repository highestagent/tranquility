"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Minus,
  Telescope,
} from "lucide-react"

import { ScatterPlot } from "@/components/charts/scatter-plot"
import { cn } from "@/lib/utils"
import { formatMetric, formatTick, getAssessment } from "@/modules/assessments"
import type { Analysis, Discovery } from "@/modules/memory"
import { getDomain, getQuestion } from "@/modules/questionnaire"

import type { DiscoveryView } from "./discovery-data"
import { StrengthMeter } from "./strength-meter"
import { ThreadGlyph } from "./thread-glyph"

function helpsFrom(metric: Analysis["metric"], effect: number | null) {
  if (effect === null || effect === 0) return null
  const definition = getAssessment(metric.assessmentId)?.metrics.find(
    ({ id }) => id === metric.metricId
  )
  if (!definition) return null
  return effect > 0 === definition.higherIsBetter
}

const VERDICTS: Record<
  Discovery["verdict"],
  { label: string; Icon: typeof Check; solid: boolean }
> = {
  supported: { label: "Supported", Icon: Check, solid: true },
  refuted: { label: "No link", Icon: Minus, solid: false },
  inconclusive: { label: "Unclear", Icon: CircleHelp, solid: false },
}

/** Which habit and ability this is about, and what the evidence decided. */
export function DiscoveryEyebrow({ view }: { view: DiscoveryView }) {
  const { discovery, hypothesis, analysis } = view
  const question = hypothesis ? getQuestion(hypothesis.factorId) : undefined
  const assessment = hypothesis
    ? getAssessment(hypothesis.metric.assessmentId)
    : undefined
  const verdict = VERDICTS[discovery.verdict]
  const helps =
    hypothesis && analysis
      ? helpsFrom(hypothesis.metric, analysis.effect)
      : null

  return (
    <div className="flex items-center justify-between gap-3">
      {question && assessment ? (
        <ThreadGlyph
          FactorIcon={getDomain(question.domain).Icon}
          AbilityIcon={assessment.Icon}
          helps={helps}
          settled={discovery.verdict === "supported"}
        />
      ) : (
        <Telescope aria-hidden className="size-6 text-muted-foreground" />
      )}
      <Badge
        variant="outline"
        className={cn(
          "stamp-in flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
          verdict.solid
            ? "border-glow bg-glow text-glow-foreground"
            : "border-border text-muted-foreground"
        )}
      >
        <verdict.Icon aria-hidden className="size-3.5" />
        {verdict.label}
      </Badge>
    </div>
  )
}

/** The chart, how strong the evidence is, and the rest one tap away. */
export function DiscoveryEvidence({ view }: { view: DiscoveryView }) {
  const { discovery, hypothesis, analysis, points } = view
  const question = hypothesis ? getQuestion(hypothesis.factorId) : undefined
  const metric = hypothesis
    ? getAssessment(hypothesis.metric.assessmentId)?.metrics.find(
        ({ id }) => id === hypothesis.metric.metricId
      )
    : undefined

  return (
    <>
      {question && metric && points.length > 0 ? (
        <ScatterPlot
          points={points}
          xLabel={question.label}
          yLabel={metric.unit === "ms" ? `${metric.label} (ms)` : metric.label}
          formatY={(value) => formatMetric(value, metric)}
          formatYTick={(value) => formatTick(value, metric)}
          binary={question.kind.type === "yes-no"}
          showTrend={
            discovery.grade === "strong" || discovery.grade === "moderate"
          }
          expectedSign={analysis?.effect ?? 0}
        />
      ) : null}

      <Collapsible className="group text-sm">
        <CollapsibleTrigger className="group flex w-full cursor-pointer list-none items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StrengthMeter grade={discovery.grade} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            Details
            <ChevronDown
              aria-hidden
              className="size-3.5 transition-transform duration-200 group-aria-expanded:rotate-180"
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="mt-4 flex flex-col gap-3">
            <Detail
              Icon={Telescope}
              label="Evidence"
              text={discovery.evidence}
            />
            <Detail
              Icon={Check}
              label="Reliability"
              text={discovery.reliability}
            />
            <Detail
              Icon={CircleHelp}
              label="Uncertain"
              text={discovery.uncertainty}
            />
            <Detail Icon={Compass} label="Next" text={discovery.nextStep} />
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}

/** A finding as a self-contained card, for lists. */
export function DiscoveryCard({ view }: { view: DiscoveryView }) {
  return (
    <Card className="gap-4 rounded-[1.75rem] p-5 text-sm lg:p-6">
      <DiscoveryEyebrow view={view} />
      <h2 className="voice-title text-balance">{view.discovery.observed}</h2>
      <DiscoveryEvidence view={view} />
    </Card>
  )
}

function Detail({
  Icon,
  label,
  text,
}: {
  Icon: typeof Check
  label: string
  text: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div>
        <dt className="sr-only">{label}</dt>
        <dd className="text-pretty text-muted-foreground">{text}</dd>
      </div>
    </div>
  )
}
