"use client"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"
import { Screen, Section } from "@/components/screen"
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

type JournalEntry = Awaited<ReturnType<typeof loadJournal>>[number]

function formatWhen(at: number) {
  return new Date(at).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function describeCounts(entry: JournalEntry) {
  return [
    `${entry.answers.length + entry.context.length} contextual answers`,
    `${entry.runs.length} measurements`,
    `${entry.findings.length} findings`,
  ].join(" · ")
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm">
      The journal or recalculation could not finish.
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

/** Every session, newest first. Each opens on its own page. */
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
        <LoadFailed onRetry={() => void reload()} />
      ) : state.data.length === 0 ? (
        <p>Your first session will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.data.map((entry) => (
            <li key={entry.session.id}>
              <Link
                href={`/journal/${entry.session.id}`}
                className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="flex-row items-center gap-3 rounded-3xl p-4 pl-5 text-sm transition-colors hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <time
                      dateTime={new Date(entry.session.startedAt).toISOString()}
                      className="font-medium"
                    >
                      {formatWhen(entry.session.startedAt)}
                    </time>
                    {entry.summary ? (
                      <p className="mt-1 line-clamp-2 text-pretty">
                        {entry.summary.summary}
                      </p>
                    ) : null}
                    <p className="mt-1 text-muted-foreground">
                      {describeCounts(entry)}
                    </p>
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}

/** One session in full: what was asked, measured, found, and decided. */
export function JournalEntryView({ sessionId }: { sessionId: string }) {
  const load = useCallback(
    async () =>
      (await loadJournal()).find(({ session }) => session.id === sessionId) ??
      null,
    [sessionId]
  )
  const { state, reload } = useAsync(load)
  const entry = state.status === "ready" ? state.data : null

  return (
    <Screen
      eyebrow={
        <Link
          href="/journal"
          className="inline-flex min-h-11 w-fit items-center gap-1 rounded eyebrow outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Journal
        </Link>
      }
      title={entry ? formatWhen(entry.session.startedAt) : "Session"}
    >
      {state.status === "loading" ? (
        <p role="status">Loading this session…</p>
      ) : state.status === "error" ? (
        <LoadFailed onRetry={() => void reload()} />
      ) : !entry ? (
        <p className="text-sm text-muted-foreground">
          This session isn&apos;t stored on this device.
        </p>
      ) : (
        <EntryDetails entry={entry} onSaved={reload} />
      )}
    </Screen>
  )
}

function EntryDetails({
  entry,
  onSaved,
}: {
  entry: JournalEntry
  onSaved: () => Promise<void>
}) {
  const notes = entry.log.filter((d) => d.reason)
  const hasAnswers = entry.answers.length + entry.context.length > 0
  return (
    <>
      {entry.summary ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-pretty">{entry.summary.summary}</p>
          <p className="text-pretty text-muted-foreground">
            Next: {entry.summary.nextStep}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{describeCounts(entry)}</p>
      )}

      {hasAnswers ? (
        <Section label="Answers">
          <Card className="gap-0 rounded-3xl px-5 py-1 text-sm">
            <ul className="flex flex-col divide-y divide-border">
              {entry.answers.map((answer) => (
                <li key={answer.id} className="py-4">
                  <AnswerEntry answer={answer} onSaved={onSaved} />
                </li>
              ))}
              {entry.context.map((answer) => (
                <li key={answer.id} className="flex flex-col gap-1 py-4">
                  <p>{answer.message}</p>
                  <p className="text-muted-foreground">
                    {answer.value === null
                      ? "Skipped"
                      : Array.isArray(answer.value)
                        ? answer.value.join(", ")
                        : String(answer.value)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      {entry.runs.length > 0 ? (
        <Section label="Measurements">
          <Card className="gap-0 rounded-3xl px-5 py-1 text-sm">
            <ul className="flex flex-col divide-y divide-border">
              {entry.runs.map((run) => {
                const assessment = getAssessment(run.assessmentId)
                return (
                  <li key={run.id} id={run.id} className="py-4">
                    <Collapsible>
                      <CollapsibleTrigger className="cursor-pointer rounded text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                        {assessment?.shortName ?? run.assessmentId} ·{" "}
                        {run.valid ? "Completed" : "Invalid run"}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <dl className="mt-3 flex flex-col gap-2 text-muted-foreground">
                          {assessment?.metrics.map((metric) => (
                            <div
                              key={metric.id}
                              className="flex justify-between gap-3"
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
                        </dl>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Protocol version {run.protocolVersion}. A single
                          measurement is not diagnostic.
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                )
              })}
            </ul>
          </Card>
        </Section>
      ) : null}

      {entry.findings.length > 0 ? (
        <Section label="Findings">
          <div className="flex flex-col gap-3">
            {entry.findings.map((f) => (
              <Card key={f.id} className="gap-2 rounded-3xl p-4 pl-5 text-sm">
                <Link
                  href="/findings"
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {f.observed}
                </Link>
                <p className="text-muted-foreground">
                  {f.grade} evidence · {f.verdict}
                </p>
                <p className="text-pretty text-muted-foreground">
                  {f.evidence} {f.uncertainty}
                </p>
                <p className="text-pretty">Next: {f.nextStep}</p>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {notes.length > 0 ? (
        <Section label="Agent notes">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {notes.map((d) => (
              <li key={d.id} className="text-pretty">
                {d.reason}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
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
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p>{question.prompt}</p>
          <p className="text-muted-foreground">
            {answer.value === null
              ? "Skipped"
              : question.kind.type === "yes-no"
                ? answer.value
                  ? "Yes"
                  : "No"
                : answer.value}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Correct"}
        </Button>
      </div>
      {editing ? (
        <>
          <p className="text-xs text-muted-foreground">
            Saving withdraws previous findings and recalculates analyses, here
            and on your other devices. They must be evaluated again before
            drawing conclusions.
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
