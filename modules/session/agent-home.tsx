"use client"

import {
  ArrowRight,
  ChevronRight,
  Gamepad2,
  RotateCcw,
  Square,
} from "lucide-react"
import Link from "next/link"

import { PoolMark } from "@/components/pool-mark"
import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { AgentPool } from "@/modules/insights/agent-pool"
import { DiscoveryCard } from "@/modules/insights/discovery-card"
import { KnowledgeMap, MapLegend } from "@/modules/insights/knowledge-map"
import type { InvestigationSummary } from "@/modules/investigation"
import { AssessmentRunner } from "@/modules/assessments/runner/assessment-runner"
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
      <div className="rise-in flex flex-col gap-4">
        <DiscoveryCard view={next} />
        <Button
          size="lg"
          className="self-center"
          onClick={session.dismissDiscovery}
        >
          {snapshot.unseen.length > 1 || pending ? "Next" : "Done"}
          <ArrowRight aria-hidden data-icon="inline-end" />
        </Button>
      </div>
    )
  }

  if (phase === "asking" && pending?.kind === "questions") {
    return (
      <div className="flex flex-col gap-4">
        <TaskReason reason={pending.reason}>
          <AgentPool
            state="resting"
            stage="question"
            className="size-11 shrink-0"
          />
        </TaskReason>
        <QuestionFlow
          key={pending.id}
          questionIds={pending.questionIds}
          onDone={session.finishQuestions}
        />
      </div>
    )
  }

  if (phase === "playing" && pending?.kind === "assessment") {
    return (
      <div className="flex flex-col gap-4">
        {/* A still mark, because nothing may move beside a game being measured. */}
        <TaskReason reason={pending.reason}>
          <PoolMark className="size-9 shrink-0" />
        </TaskReason>
        <AssessmentRunner
          key={pending.id}
          assessmentId={pending.assessmentId}
          onFinish={session.finishAssessment}
          doneLabel="Continue"
        />
      </div>
    )
  }

  const thinking = phase === "thinking"
  const failed = phase === "error"

  return (
    <div className="flex flex-1 flex-col gap-5">
      {activity.asked ? (
        <p className="rise-in self-end rounded-2xl rounded-br-md bg-muted px-4 py-2 text-sm text-pretty">
          {activity.asked}
        </p>
      ) : null}

      <KnowledgeMap
        knowledge={snapshot.knowledge}
        state={thinking ? "thinking" : failed ? "error" : "resting"}
        stage={thinking ? (activity.stage ?? "understand") : null}
        visited={activity.visited}
        focus={thinking ? activity.focus : null}
        scanning={thinking && activity.scanning}
      />
      {!thinking ? <MapLegend links={snapshot.knowledge.links} /> : null}

      {thinking ? (
        <div className="flex flex-col items-center gap-3">
          <p
            key={activity.caption}
            aria-live="polite"
            className="rise-in text-center font-voice text-xl text-balance text-muted-foreground italic"
          >
            {activity.spoken ?? activity.caption ?? "Waking up…"}
          </p>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Stop"
            title="Stop"
            onClick={session.stop}
          >
            <Square aria-hidden className="size-3.5 fill-current" />
          </Button>
        </div>
      ) : null}

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3">
          <p className="text-center font-voice text-2xl text-balance">
            {session.errorText}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={session.retry}>
              <RotateCcw aria-hidden data-icon="inline-start" />
              Try again
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/assessments" />}
            >
              <Gamepad2 aria-hidden data-icon="inline-start" />
              Games
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "resting" ? (
        <div className="rise-in flex flex-col gap-5">
          {session.spoken ? (
            <p className="text-center font-voice text-2xl text-balance">
              {session.spoken}
            </p>
          ) : null}
          <ActiveThread investigations={snapshot.open} />
          <Button size="lg" className="self-center" onClick={session.keepGoing}>
            Keep going
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
          <Composer onAsk={session.ask} />
          <DecisionLog decisions={snapshot.log} />
        </div>
      ) : null}

      <p className="mt-auto pt-2 text-center text-xs text-muted-foreground">
        Not a medical tool.
      </p>
    </div>
  )
}

function TaskReason({
  reason,
  children,
}: {
  reason: string
  children: React.ReactNode
}) {
  return (
    <div className="rise-in flex items-center gap-3">
      {children}
      <p className="font-voice text-lg leading-snug text-pretty italic">
        {reason}
      </p>
    </div>
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
      className="flex items-center gap-3 rounded-full border border-border bg-card py-2 pr-3 pl-2.5 transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
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
      <span className="min-w-0 flex-1 truncate text-sm">{active.title}</span>
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
