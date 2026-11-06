"use client"

import {
  ArrowRight,
  ChevronRight,
  Gamepad2,
  RotateCcw,
  Square,
} from "lucide-react"
import Link from "next/link"

import { AgentNote } from "@/components/agent-note"
import { Screen } from "@/components/screen"
import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { AssessmentRunner } from "@/modules/assessments/runner/assessment-runner"
import {
  DiscoveryEvidence,
  DiscoveryEyebrow,
} from "@/modules/insights/discovery-card"
import { KnowledgeMap, MapLegend } from "@/modules/insights/knowledge-map"
import type { InvestigationSummary } from "@/modules/investigation"
import { QuestionFlow } from "@/modules/questionnaire/question-flow"

import { Composer } from "./composer"
import { DecisionLog } from "./decision-log"
import { useAgentSession } from "./use-agent-session"

export function AgentHome() {
  const session = useAgentSession()
  const { phase, activity, snapshot, pending } = session

  if (phase === "storage-error") {
    return <StorageError onRetry={session.reload} />
  }
  if (phase === "loading" || !snapshot) return <LoadingMessage />

  if (phase === "reveal") {
    const next = snapshot.unseen[0]!
    return (
      <Screen
        key={next.discovery.id}
        eyebrow={<DiscoveryEyebrow view={next} />}
        title={next.discovery.observed}
        dock={
          <Button size="cta" onClick={session.dismissDiscovery}>
            {snapshot.unseen.length > 1 || pending ? "Next" : "Done"}
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
        }
      >
        <DiscoveryEvidence view={next} />
      </Screen>
    )
  }

  if (phase === "asking" && pending?.kind === "questions") {
    return (
      <QuestionFlow
        key={pending.id}
        questionIds={pending.questionIds}
        eyebrow={<AgentNote>{pending.reason}</AgentNote>}
        onDone={session.finishQuestions}
      />
    )
  }

  if (phase === "playing" && pending?.kind === "assessment") {
    return (
      <AssessmentRunner
        key={pending.id}
        assessmentId={pending.assessmentId}
        eyebrow={<AgentNote>{pending.reason}</AgentNote>}
        onFinish={session.finishAssessment}
        doneLabel="Continue"
      />
    )
  }

  const map = (
    <div className="my-auto flex flex-col gap-3">
      <KnowledgeMap
        knowledge={snapshot.knowledge}
        state={
          phase === "thinking"
            ? "thinking"
            : phase === "error"
              ? "error"
              : "resting"
        }
        stage={phase === "thinking" ? (activity.stage ?? "understand") : null}
        visited={activity.visited}
        focus={phase === "thinking" ? activity.focus : null}
        scanning={phase === "thinking" && activity.scanning}
      />
      {phase === "thinking" ? null : (
        <MapLegend links={snapshot.knowledge.links} />
      )}
    </div>
  )
  const asked = activity.asked ? (
    <p className="text-sm text-muted-foreground">“{activity.asked}”</p>
  ) : undefined

  if (phase === "thinking") {
    const line = activity.spoken ?? activity.caption ?? "Waking up…"
    return (
      <Screen
        eyebrow={asked}
        title={<span className="block min-h-[3.9rem]">{line}</span>}
        titleKey={line}
        live
        dock={
          <Button
            variant="ghost"
            size="cta"
            className="text-muted-foreground"
            onClick={session.stop}
          >
            <Square
              aria-hidden
              data-icon="inline-start"
              className="size-3 fill-current"
            />
            Stop
          </Button>
        }
      >
        {map}
      </Screen>
    )
  }

  if (phase === "error") {
    return (
      <div role="alert" className="flex flex-1 flex-col">
        <Screen
          eyebrow={asked}
          title={session.errorText}
          dock={
            <>
              <Button size="cta" onClick={session.retry}>
                <RotateCcw aria-hidden data-icon="inline-start" />
                Try again
              </Button>
              <Button
                size="cta"
                variant="ghost"
                nativeButton={false}
                render={<Link href="/assessments" />}
              >
                <Gamepad2 aria-hidden data-icon="inline-start" />
                Games
              </Button>
            </>
          }
        >
          {map}
        </Screen>
      </div>
    )
  }

  return (
    <Screen
      eyebrow={asked}
      title={session.spoken ?? "Where next?"}
      action={<DecisionLog decisions={snapshot.log} />}
      dock={
        <>
          <Button size="cta" onClick={session.keepGoing}>
            Keep going
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
          <Composer onAsk={session.ask} />
        </>
      }
    >
      {map}
      <ActiveThread investigations={snapshot.open} />
    </Screen>
  )
}

/** The investigation in progress, with how much of its evidence is in. */
function ActiveThread({
  investigations,
}: {
  investigations: readonly InvestigationSummary[]
}) {
  const active = investigations.find(({ status }) => status === "active")
  if (!active) return null
  const progress =
    active.evidence.length === 0
      ? 0
      : active.evidence.reduce(
          (sum, { have, need }) => sum + Math.min(1, have / need),
          0
        ) / active.evidence.length

  return (
    <Link
      href="/findings"
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg
        viewBox="0 0 36 36"
        aria-hidden
        className="size-8 shrink-0 -rotate-90"
      >
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="var(--border)"
          strokeWidth="4"
        />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${progress * 100} 100`}
        />
      </svg>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {active.title}
      </span>
      <span className="sr-only">
        {Math.round(progress * 100)}% of evidence collected
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  )
}
