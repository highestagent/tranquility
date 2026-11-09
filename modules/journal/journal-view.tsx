"use client"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import Link from "next/link"
import { useState } from "react"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import {
  sessions,
  responses,
  measurements,
  decisions,
  discoveries,
  kv,
  type QuestionResponse,
} from "@/modules/memory"
import { getQuestion } from "@/modules/questionnaire"
import { getAssessment, formatMetric } from "@/modules/assessments"
import { questionInteraction } from "@/modules/interaction/catalog"
import { InteractionRenderer } from "@/modules/interaction/renderer"
import type { ContextAnswer } from "@/modules/session/checkpoint"
import { correctAnswer, resumeRecalculation } from "./corrections"
async function loadJournal() {
  await resumeRecalculation()
  const [visits, answers, runs, log, findings, context] = await Promise.all([
    sessions.list(),
    responses.list(),
    measurements.list(),
    decisions.list(),
    discoveries.list(),
    kv.get<ContextAnswer[]>("contextAnswers"),
  ])
  const summaries = await Promise.all(
    visits.map(
      async (s) =>
        [
          s.id,
          await kv.get<{ summary: string; nextStep: string }>(
            `sessionSummary:${s.id}`
          ),
        ] as const
    )
  )
  const summaryById = new Map(summaries)
  return visits
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((session, index, all) => ({
      session,
      summary: summaryById.get(session.id),
      answers: answers.filter((r) => r.sessionId === session.id),
      runs: runs.filter((r) => r.sessionId === session.id),
      log: log.filter((r) => r.sessionId === session.id),
      context: (context ?? []).filter((r) => r.sessionId === session.id),
      findings: findings.filter(
        (f) =>
          f.createdAt >= session.startedAt &&
          f.createdAt < (all[index - 1]?.startedAt ?? Infinity)
      ),
    }))
}
export function JournalView() {
  const { state, reload } = useAsync(loadJournal)
  return (
    <Screen
      eyebrow={<p className="eyebrow">Research journal</p>}
      title="The story so far."
    >
      <p className="text-sm text-muted-foreground">
        Context, measurements, and research decisions, kept on this device.
        Contextual answers can be corrected; measured outcomes cannot be edited.
      </p>
      {state.status === "loading" ? (
        <p role="status">Loading your research…</p>
      ) : state.status === "error" ? (
        <div role="alert">
          The journal or recalculation could not finish.
          <Button onClick={() => void reload()}>Retry</Button>
        </div>
      ) : state.data.length === 0 ? (
        <p>Your first session will appear here.</p>
      ) : (
        state.data.map((entry) => (
          <Card key={entry.session.id} className="rounded-xl p-5 text-sm">
            <Collapsible>
              <CollapsibleTrigger className="cursor-pointer rounded text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                <time className="font-medium">
                  {new Date(entry.session.startedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                <span className="mt-2 block text-sm text-muted-foreground">
                  {entry.answers.length + entry.context.length} contextual
                  answers · {entry.runs.length} measurements ·{" "}
                  {entry.findings.length} findings
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-6 space-y-6">
                  {entry.summary ? (
                    <div className="space-y-2">
                      <p>{entry.summary.summary}</p>
                      <p className="text-sm text-muted-foreground">
                        Next: {entry.summary.nextStep}
                      </p>
                    </div>
                  ) : null}
                  {entry.answers.map((answer) => (
                    <AnswerEntry
                      key={answer.id}
                      answer={answer}
                      onSaved={reload}
                    />
                  ))}
                  {entry.context.map((answer) => (
                    <div key={answer.id}>
                      <p className="text-sm">{answer.message}</p>
                      <p className="text-sm text-muted-foreground">
                        {answer.value === null
                          ? "Skipped"
                          : Array.isArray(answer.value)
                            ? answer.value.join(", ")
                            : String(answer.value)}
                      </p>
                    </div>
                  ))}
                  {entry.runs.map((run) => {
                    const assessment = getAssessment(run.assessmentId)
                    return (
                      <Collapsible key={run.id} id={run.id}>
                        <CollapsibleTrigger className="cursor-pointer rounded text-left text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                          {assessment?.shortName ?? run.assessmentId} ·{" "}
                          {run.valid ? "Completed" : "Invalid run"}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {assessment?.metrics.map((metric) => (
                              <div
                                key={metric.id}
                                className="flex justify-between"
                              >
                                <dt>{metric.label}</dt>
                                <dd>
                                  {run.metrics[metric.id] === undefined
                                    ? "—"
                                    : formatMetric(
                                        run.metrics[metric.id],
                                        metric
                                      )}
                                </dd>
                              </div>
                            ))}
                            <p>
                              Protocol version {run.protocolVersion}. A single
                              measurement is not diagnostic.
                            </p>
                          </dl>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                  {entry.log
                    .filter((d) => d.reason)
                    .map((d) => (
                      <p key={d.id} className="text-sm text-muted-foreground">
                        {d.reason}
                      </p>
                    ))}
                  {entry.findings.map((f) => (
                    <article key={f.id} className="space-y-2 border-t pt-4">
                      <Link
                        href="/findings"
                        className="underline underline-offset-4"
                      >
                        {f.observed}
                      </Link>
                      <p className="text-sm">
                        {f.grade} evidence · {f.verdict}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {f.evidence} {f.uncertainty}
                      </p>
                      <p className="text-sm">Next: {f.nextStep}</p>
                    </article>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))
      )}
    </Screen>
  )
}
function AnswerEntry({
  answer,
  onSaved,
}: {
  answer: QuestionResponse
  onSaved: () => Promise<void>
}) {
  const question = getQuestion(answer.questionId)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  if (!question) return null
  return (
    <div className="space-y-3">
      <p className="text-sm">{question.prompt}</p>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {answer.value === null
            ? "Skipped"
            : question.kind.type === "yes-no"
              ? answer.value
                ? "Yes"
                : "No"
              : answer.value}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
          {" "}
          {editing ? "Cancel" : "Correct"}
        </Button>
      </div>
      {editing ? (
        <>
          <p className="text-xs text-muted-foreground">
            Saving withdraws previous findings and recalculates analyses. They
            must be evaluated again before drawing conclusions. Previously
            synced memories may still exist remotely.
          </p>
          <InteractionRenderer
            interaction={questionInteraction(question)}
            disabled={busy}
            onAnswer={async (value) => {
              setBusy(true)
              setError(false)
              try {
                await correctAnswer(
                  answer.id,
                  typeof value === "boolean"
                    ? Number(value)
                    : (value as number | null)
                )
                setEditing(false)
                await onSaved()
              } catch {
                setError(true)
              } finally {
                setBusy(false)
              }
            }}
          />
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm">
          The update could not finish. Retry to complete recalculation.
        </p>
      ) : null}
    </div>
  )
}
