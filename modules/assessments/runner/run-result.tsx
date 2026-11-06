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
  if (Math.abs(change) < NOTABLE_CHANGE)
    return { kind: "same" as const, percent: 0 }
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
      <div
        role="alert"
        className="flex flex-col items-center gap-4 py-6 text-center"
      >
        <p className="font-voice text-xl">Run cancelled. The tab lost focus.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={onRetry}>
            <RotateCcw aria-hidden data-icon="inline-start" />
            Again
          </Button>
          <Button size="lg" variant="outline" onClick={onDone}>
            {doneLabel}
          </Button>
        </div>
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
  const others = assessment.metrics.filter(({ id }) => id !== primary.id)

  return (
    <div className="flex flex-col items-center gap-5">
      {value !== undefined ? (
        <div className="rise-in flex flex-col items-center gap-1">
          <p className="font-mono text-5xl tabular-nums">
            {formatMetric(value, primary)}
          </p>
          <p className="text-sm text-muted-foreground">{primary.label}</p>
        </div>
      ) : null}

      {comparison ? (
        <p className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
          {comparison.kind === "same" ? (
            <>
              <Equal aria-hidden className="size-4" />
              As usual
            </>
          ) : comparison.kind === "better" ? (
            <>
              <ArrowUpRight aria-hidden className="size-4 text-primary" />
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
          aria-label={`${Math.min(prior.length + 1, MIN_BASELINE_RUNS + 1)} of ${MIN_BASELINE_RUNS + 1} runs towards your baseline`}
          className="flex gap-1.5"
        >
          {Array.from({ length: MIN_BASELINE_RUNS + 1 }, (_, dot) => (
            <span
              key={dot}
              className={
                dot <= prior.length
                  ? "size-2 rounded-full bg-primary"
                  : "size-2 rounded-full bg-border"
              }
            />
          ))}
        </div>
      )}

      <Sparkline
        values={series.slice(-14)}
        invert={!primary.higherIsBetter}
        label={primary.label}
        format={(point) => formatMetric(point, primary)}
        className="w-full max-w-xs"
      />

      {others.length > 0 ? (
        <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {others.flatMap((metric) => {
            const other = measurement.metrics[metric.id]
            if (other === undefined) return []
            return (
              <div
                key={metric.id}
                className="rounded-2xl bg-muted p-3 text-center"
              >
                <dd className="font-mono text-sm tabular-nums">
                  {formatMetric(other, metric)}
                </dd>
                <dt className="text-xs text-muted-foreground">
                  {metric.label}
                </dt>
              </div>
            )
          })}
        </dl>
      ) : null}

      <Button size="lg" onClick={onDone}>
        {doneLabel}
        <ArrowRight aria-hidden data-icon="inline-end" />
      </Button>
    </div>
  )
}
