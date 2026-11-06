"use client"

import { Check, ChevronRight, ClipboardList } from "lucide-react"
import Link from "next/link"

import { Sparkline } from "@/components/charts/sparkline"
import { useAsync } from "@/hooks/use-async"
import { measurements } from "@/modules/memory"
import {
  askedThisSession,
  coreQuestionIds,
  resolveQuestions,
} from "@/modules/questionnaire"

import { formatMetric } from "./format"
import { ASSESSMENTS } from "./registry"

async function loadGames() {
  const [entries, asked] = await Promise.all([
    Promise.all(
      ASSESSMENTS.map(async ({ id, primaryMetricId }) => {
        const runs = await measurements.byAssessment(id)
        const values = runs
          .filter((run) => run.valid)
          .flatMap((run) => run.metrics[primaryMetricId] ?? [])
        return [id, values] as const
      })
    ),
    askedThisSession(),
  ])
  return {
    history: new Map(entries),
    checkedIn: resolveQuestions(coreQuestionIds(), asked).length === 0,
  }
}

const rowStyle =
  "flex items-center gap-3 rounded-3xl border border-border bg-card p-4 transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"

export function GamesView() {
  const { state } = useAsync(loadGames)
  const data = state.status === "ready" ? state.data : null

  return (
    <>
      {data?.checkedIn ? (
        <p className={rowStyle}>
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Check aria-hidden className="size-5" />
          </span>
          <span className="font-medium">Checked in</span>
        </p>
      ) : (
        <Link href="/check-in" className={rowStyle}>
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ClipboardList aria-hidden className="size-5" />
          </span>
          <span className="flex-1 font-medium">Check in</span>
          <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
        </Link>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {ASSESSMENTS.map(
          ({ id, shortName, Preview, primaryMetricId, metrics }) => {
            const primary = metrics.find(
              (metric) => metric.id === primaryMetricId
            )!
            const values = data?.history.get(id) ?? []
            return (
              <li key={id}>
                <Link
                  href={`/assessments/${id}`}
                  className="flex h-full flex-col gap-3 rounded-3xl border border-border bg-card p-3 transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-28 items-center justify-center overflow-hidden">
                    <span className="block h-full w-full">
                      <Preview />
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2 px-1">
                    <span className="text-sm font-medium">{shortName}</span>
                    {values.length > 0 ? (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {values.length}×
                      </span>
                    ) : null}
                  </span>
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
    </>
  )
}
