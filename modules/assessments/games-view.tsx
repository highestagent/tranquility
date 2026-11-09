"use client"

import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
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

const rowStyle = buttonVariants({
  variant: "outline",
  className: "h-auto w-full justify-start gap-3 rounded-3xl p-3 pr-4",
})

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
          <span className="text-sm font-medium">Checked in</span>
        </p>
      ) : (
        <Link href="/check-in" className={rowStyle}>
          <span className="flex size-10 items-center justify-center rounded-full bg-glow text-glow-foreground">
            <ClipboardList aria-hidden className="size-5" />
          </span>
          <span className="flex-1 text-sm font-medium">Check in</span>
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
                  className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full gap-3 rounded-3xl p-3.5 transition-colors group-hover:bg-muted">
                    <span className="flex h-28 items-center justify-center">
                      <Preview />
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
                  </Card>
                </Link>
              </li>
            )
          }
        )}
      </ul>
    </>
  )
}
