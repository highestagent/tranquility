"use client"

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Equal,
  RotateCcw,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Sparkline } from "@/components/charts/sparkline"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { median } from "@/lib/stats"
import { measurements, type Measurement } from "@/modules/memory"

import { formatMetric } from "../format"
import type { AssessmentDefinition } from "../types"

const MIN_BASELINE_RUNS = 3
/** Differences smaller than this are noise, not worth pointing out. */
const NOTABLE_CHANGE = 0.02

function compareToUsual(
  value: number,
  prior: readonly number[],
  higherIsBetter: boolean
) {
  if (prior.length < MIN_BASELINE_RUNS) return null
  const usual = median(prior)
  if (usual === 0) return null
  const change = (value - usual) / Math.abs(usual)
  if (Math.abs(change) < NOTABLE_CHANGE) {
    return { kind: "same" as const, percent: 0 }
  }
  return {
    kind:
      change > 0 === higherIsBetter ? ("better" as const) : ("worse" as const),
    percent: Math.round(Math.abs(change) * 100),
  }
}

export function RunResult({
  assessment,
  measurement,
  doneLabel,
  onRetry,
  onDone,
}: {
  assessment: AssessmentDefinition<never>
  measurement: Measurement
  doneLabel: string
  onRetry: () => void
  onDone: () => void
}) {
  const [history, setHistory] = useState<Measurement[]>([])

  useEffect(() => {
    measurements.byAssessment(assessment.id).then(
      (runs) =>
        setHistory(
          runs.filter(
            (run) =>
              run.valid && run.protocolVersion === assessment.protocolVersion
          )
        ),
      () => setHistory([])
    )
  }, [assessment.id, assessment.protocolVersion])

  if (!measurement.valid) {
    return (
      <div role="alert" className="flex flex-1 flex-col">
        <Screen
          title="Run cancelled."
          dock={
            <>
              <Button size="cta" onClick={onRetry}>
                <RotateCcw aria-hidden data-icon="inline-start" />
                Again
              </Button>
              <Button size="cta" variant="ghost" onClick={onDone}>
                {doneLabel}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            The tab lost focus, so this one isn&apos;t counted.
          </p>
        </Screen>
      </div>
    )
  }

  const primary = assessment.metrics.find(
    ({ id }) => id === assessment.primaryMetricId
  )!
  const value = measurement.metrics[primary.id]
  const series = history.flatMap((run) => run.metrics[primary.id] ?? [])
  const prior = history
    .filter((run) => run.id !== measurement.id)
    .flatMap((run) => run.metrics[primary.id] ?? [])
  const comparison =
    value === undefined
      ? null
      : compareToUsual(value, prior, primary.higherIsBetter)
  const others = assessment.metrics.flatMap((metric) => {
    if (metric.id === primary.id) return []
    const other = measurement.metrics[metric.id]
    return other === undefined ? [] : [{ metric, value: other }]
  })

  return (
    <Screen
      eyebrow={<p className="eyebrow">{primary.label}</p>}
      title={value === undefined ? "–" : formatMetric(value, primary)}
      titleClassName="figure text-7xl"
      dock={
        <Button size="cta" onClick={onDone}>
          {doneLabel}
          <ArrowRight aria-hidden data-icon="inline-end" />
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {comparison ? (
          <p className="flex items-center gap-1.5 text-sm">
            {comparison.kind === "same" ? (
              <>
                <Equal aria-hidden className="size-4" />
                As usual
              </>
            ) : comparison.kind === "better" ? (
              <>
                <ArrowUpRight aria-hidden className="size-4 text-glow" />
                {comparison.percent}% better than usual
              </>
            ) : (
              <>
                <ArrowDownRight
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
                {comparison.percent}% below usual
              </>
            )}
          </p>
        ) : (
          <div
            role="img"
            aria-label={`Run ${Math.min(prior.length + 1, MIN_BASELINE_RUNS + 1)} of ${MIN_BASELINE_RUNS + 1} towards your baseline`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            {Array.from({ length: MIN_BASELINE_RUNS + 1 }, (_, dot) => (
              <span
                key={dot}
                className={
                  dot <= prior.length
                    ? "h-1 w-8 rounded-full bg-glow"
                    : "h-1 w-8 rounded-full bg-foreground/15"
                }
              />
            ))}
            <span className="ml-1">Your baseline</span>
          </div>
        )}
        <Sparkline
          values={series.slice(-14)}
          invert={!primary.higherIsBetter}
          label={primary.label}
          format={(point) => formatMetric(point, primary)}
          className="w-full"
        />
      </div>

      {others.length > 0 ? (
        <dl className="flex flex-col divide-y divide-border border-y border-border">
          {others.map(({ metric, value: other }) => (
            <div
              key={metric.id}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <dt className="text-sm text-muted-foreground">{metric.label}</dt>
              <dd className="text-sm tabular-nums">
                {formatMetric(other, metric)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Screen>
  )
}
