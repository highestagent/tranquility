"use client"

import {
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
import { getDomain, getQuestion } from "@/modules/questionnaire"

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
    <article
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-border bg-card p-4",
        (paused || completed) && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="pt-2 font-voice text-xl text-balance">
          {investigation.title}
        </h2>
        <div className="flex shrink-0">
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
            {completed ? <Play aria-hidden /> : <Check aria-hidden />}
          </Button>
        </div>
      </div>

      {investigation.evidence.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {investigation.evidence.map((item) => {
            const question = getQuestion(item.factorId)
            const assessment = getAssessment(item.metric.assessmentId)
            const FactorIcon = question
              ? getDomain(question.domain).Icon
              : FlaskConical
            const AbilityIcon = assessment?.Icon ?? FlaskConical
            const label = `${question?.label ?? item.factorId} and ${assessment?.shortName ?? item.metric.assessmentId}`
            return (
              <li
                key={`${item.factorId}-${item.metric.assessmentId}-${item.metric.metricId}`}
                className="flex items-center gap-2"
              >
                <FactorIcon aria-hidden className="size-4 shrink-0" />
                <div
                  role="progressbar"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={item.need}
                  aria-valuenow={Math.min(item.have, item.need)}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, (item.have / item.need) * 100)}%`,
                    }}
                  />
                </div>
                <AbilityIcon aria-hidden className="size-4 shrink-0" />
                <span className="w-11 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {item.have}/{item.need}
                </span>
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
    </article>
  )
}
