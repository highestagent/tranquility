"use client"

import Link from "next/link"
import {
  EmptyMessage,
  LoadingMessage,
  StorageError,
} from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { getQuestion } from "@/modules/questionnaire"
import { getAssessment } from "@/modules/assessments"

import { updateInvestigation } from "./service"
import { listInvestigationSummaries, type InvestigationSummary } from "./state"

const STATUS_LABELS: Record<InvestigationSummary["status"], string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
}

function evidenceLabel(item: InvestigationSummary["evidence"][number]) {
  const assessment = getAssessment(item.metric.assessmentId)
  const metric = assessment?.metrics.find(
    ({ id }) => id === item.metric.metricId
  )
  const factor = getQuestion(item.factorId)?.prompt ?? item.factorId
  return `${factor} vs. ${metric?.label.toLowerCase() ?? item.metric.metricId}`
}

export function InvestigationsView() {
  const { state, reload } = useAsync(listInvestigationSummaries)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  if (state.data.length === 0) {
    return (
      <EmptyMessage title="No investigations yet">
        <Link href="/" className="underline">
          Start a session
        </Link>{" "}
        and the agent will propose one, or ask it your own question.
      </EmptyMessage>
    )
  }

  async function setStatus(id: string, status: InvestigationSummary["status"]) {
    await updateInvestigation(id, { status })
    await reload()
  }

  return (
    <ul className="flex flex-col gap-4">
      {state.data.map((investigation) => (
        <li
          key={investigation.id}
          className="flex flex-col gap-4 border border-border p-4"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-medium">{investigation.title}</h2>
            <span className="shrink-0 text-xs text-muted-foreground">
              {STATUS_LABELS[investigation.status]}
            </span>
          </div>
          <p className="text-sm">{investigation.question}</p>
          {investigation.progressNote ? (
            <p className="text-sm text-muted-foreground">
              {investigation.progressNote}
            </p>
          ) : null}

          {investigation.evidence.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                Evidence collected
              </h3>
              {investigation.evidence.map((item) => (
                <div
                  key={`${item.factorId}-${item.metric.assessmentId}-${item.metric.metricId}`}
                  className="flex flex-col gap-1 text-sm"
                >
                  <div className="flex justify-between gap-4">
                    <span>{evidenceLabel(item)}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">
                      {item.have}/{item.need}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={item.need}
                    aria-valuenow={Math.min(item.have, item.need)}
                    aria-label={evidenceLabel(item)}
                    className="h-1 bg-muted"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, (item.have / item.need) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {investigation.hypotheses.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                Hypotheses
              </h3>
              <ul className="flex flex-col gap-1 text-sm">
                {investigation.hypotheses.map((hypothesis) => (
                  <li
                    key={hypothesis.id}
                    className="flex justify-between gap-4"
                  >
                    <span>{hypothesis.statement}</span>
                    <span className="shrink-0 text-xs text-muted-foreground capitalize">
                      {hypothesis.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {investigation.status === "active" ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => void setStatus(investigation.id, "paused")}
              >
                Pause
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                onClick={() => void setStatus(investigation.id, "active")}
              >
                {investigation.status === "paused" ? "Resume" : "Reopen"}
              </Button>
            )}
            {investigation.status !== "completed" ? (
              <Button
                size="lg"
                variant="ghost"
                onClick={() => void setStatus(investigation.id, "completed")}
              >
                Mark complete
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
