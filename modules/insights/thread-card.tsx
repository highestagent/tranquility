"use client"

import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import {
  Archive,
  Check,
  CircleHelp,
  FlaskConical,
  Minus,
  Pause,
  Play,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getAssessment } from "@/modules/assessments"
import type { InvestigationSummary } from "@/modules/investigation"
import { getQuestion } from "@/modules/questionnaire"

const HYPOTHESIS_ICONS = {
  proposed: FlaskConical,
  testing: FlaskConical,
  supported: Check,
  refuted: Minus,
  inconclusive: CircleHelp,
  rejected: X,
} as const

export function ThreadCard({
  investigation,
  onStatus,
}: {
  investigation: InvestigationSummary
  onStatus: (status: InvestigationSummary["status"]) => void
}) {
  const paused = investigation.status === "paused"
  const completed = investigation.status === "completed"

  return (
    <Card
      className={cn(
        "gap-3 rounded-3xl p-5 text-sm",
        (paused || completed) && "opacity-75"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 font-medium text-pretty">
          {investigation.title}
        </h3>
        <div className="-my-1 -mr-2 flex shrink-0">
          {completed ? null : (
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={paused ? "Resume" : "Pause"}
              title={paused ? "Resume" : "Pause"}
              onClick={() => onStatus(paused ? "active" : "paused")}
            >
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={completed ? "Reopen" : "Mark complete"}
            title={completed ? "Reopen" : "Mark complete"}
            onClick={() => onStatus(completed ? "active" : "completed")}
          >
            {completed ? <Play aria-hidden /> : <Archive aria-hidden />}
          </Button>
        </div>
      </div>

      {investigation.evidence.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {investigation.evidence.map((item) => {
            const question = getQuestion(item.factorId)
            const assessment = getAssessment(item.metric.assessmentId)
            const metric = assessment?.metrics.find(
              ({ id }) => id === item.metric.metricId
            )
            const label =
              `${question?.label ?? item.factorId} · ${assessment?.shortName ?? item.metric.assessmentId} ${metric?.label.toLowerCase() ?? ""}`.trim()
            const enough = item.have >= item.need
            return (
              <li
                key={`${item.factorId}-${item.metric.assessmentId}-${item.metric.metricId}`}
                className="flex flex-col gap-1.5"
              >
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{label}</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {enough
                      ? `${item.have} paired`
                      : `${item.have} of ${item.need}`}
                  </span>
                </div>
                <Progress
                  aria-label={`${label}: ${item.have} of ${item.need} paired sessions`}
                  max={item.need}
                  value={Math.min(item.have, item.need)}
                  className="[&_[data-slot=progress-indicator]]:bg-glow [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:rounded-full"
                />
              </li>
            )
          })}
        </ul>
      ) : null}

      {investigation.hypotheses.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {investigation.hypotheses.map((hypothesis) => {
            const Icon = HYPOTHESIS_ICONS[hypothesis.status]
            return (
              <li key={hypothesis.id} className="flex items-start gap-2">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="sr-only">{hypothesis.status}: </span>
                  {hypothesis.statement}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Card>
  )
}
