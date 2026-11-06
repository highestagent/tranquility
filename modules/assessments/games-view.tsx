"use client"

import Link from "next/link"

import { Sparkline } from "@/components/charts/sparkline"
import { useAsync } from "@/hooks/use-async"
import { measurements } from "@/modules/memory"

import { formatMetric } from "./format"
import { ASSESSMENTS } from "./registry"

async function loadHistory() {
  const entries = await Promise.all(
    ASSESSMENTS.map(async ({ id, primaryMetricId }) => {
      const runs = await measurements.byAssessment(id)
      const values = runs
        .filter((run) => run.valid)
        .flatMap((run) => run.metrics[primaryMetricId] ?? [])
      return [id, values] as const
    })
  )
  return new Map(entries)
}

export function GamesView() {
  const { state } = useAsync(loadHistory)
  const history = state.status === "ready" ? state.data : null

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ASSESSMENTS.map(
        ({ id, shortName, tagline, Preview, primaryMetricId, metrics }) => {
          const primary = metrics.find(
            (metric) => metric.id === primaryMetricId
          )!
          const values = history?.get(id) ?? []
          return (
            <li key={id}>
              <Link
                href={`/assessments/${id}`}
                className="flex h-full flex-col gap-3 rounded-3xl border border-border bg-card p-4 transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Preview />
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{shortName}</span>
                  {values.length > 0 ? (
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {values.length}×
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-muted-foreground">{tagline}</span>
                <Sparkline
                  values={values.slice(-14)}
                  invert={!primary.higherIsBetter}
                  label={shortName}
                  format={(value) => formatMetric(value, primary)}
                  className="w-full"
                />
              </Link>
            </li>
          )
        }
      )}
    </ul>
  )
}
