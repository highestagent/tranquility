"use client"

import {
  ArrowRight,
  ChevronRight,
  Gamepad2,
  MessageCircle,
  RotateCcw,
  Square,
} from "lucide-react"
import Link from "next/link"

import { AgentNote } from "@/components/agent-note"
import { HeroLayout } from "@/components/screen"
import { Sheet } from "@/components/sheet"
import { StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { AssessmentRunner } from "@/modules/assessments/runner/assessment-runner"
import { AgentOrb, type OrbState } from "@/modules/insights/agent-orb"
import {
  DiscoveryEvidence,
  DiscoveryEyebrow,
} from "@/modules/insights/discovery-card"
import { KnowledgeMap, MapLegend } from "@/modules/insights/knowledge-map"
import { STAGES } from "@/modules/insights/stages"
import type { InvestigationSummary } from "@/modules/investigation"
import { QuestionFlow } from "@/modules/questionnaire/question-flow"

import { Composer } from "./composer"
import { DecisionLog } from "./decision-log"
import { splitSpeech } from "./speech"
import { useAgentSession } from "./use-agent-session"

/** Past this, the clamped detail may be cut off, so offer the rest. */
const LONG_DETAIL_CHARS = 150

/** The orb alone, for the moment before the agent's state is restored. */
export function HomeLoading() {
  return (
    <div role="status" aria-label="Loading" className="m-auto size-72">
      <AgentOrb state="resting" radius={0.3} />
    </div>
  )
}

export function AgentHome() {
  const session = useAgentSession()
  const { phase, activity, snapshot, pending } = session

  if (phase === "storage-error") {
    return <StorageError onRetry={session.reload} />
  }
  if (phase === "loading" || !snapshot) return <HomeLoading />

  if (phase === "reveal") {
    const next = snapshot.unseen[0]!
    return (
      <HeroLayout
        key={next.discovery.id}
        textFirst
        eyebrow={<DiscoveryEyebrow view={next} />}
        title={next.discovery.observed}
        visual={
          <div className="flex w-full flex-col gap-4 rounded-[1.75rem] p-5 surface lg:max-w-xl lg:p-6">
            <DiscoveryEvidence view={next} />
          </div>
        }
        dock={
          <Button size="cta" onClick={session.dismissDiscovery}>
            {snapshot.unseen.length > 1 || pending ? "Next" : "Done"}
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
        }
      />
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

  const orbState: OrbState =
    phase === "thinking" ? "thinking" : phase === "error" ? "error" : "resting"
  const stage = phase === "thinking" ? (activity.stage ?? "understand") : null

  // Bounded by the screen's height, so what's below always stays in reach.
  const visual = (
    <div className="flex w-full max-w-[min(100%,44svh)] flex-col items-center gap-1 lg:max-w-[min(100%,74svh)]">
      <KnowledgeMap
        knowledge={snapshot.knowledge}
        state={orbState}
        stage={stage}
        focus={phase === "thinking" ? activity.focus : null}
        scanning={phase === "thinking" && activity.scanning}
      />
      {phase === "thinking" ? null : (
        <MapLegend knowledge={snapshot.knowledge} />
      )}
    </div>
  )
  const asked = activity.asked ? (
    <p className="text-sm text-pretty text-muted-foreground">
      “{activity.asked}”
    </p>
  ) : null

  if (phase === "thinking") {
    const line = activity.spoken ?? activity.caption ?? session.startingLine
    return (
      <HeroLayout
        visual={visual}
        eyebrow={
          <p key={stage} className="rise-in eyebrow">
            {stage ? STAGES[stage].label : ""}
          </p>
        }
        title={
          <span className="line-clamp-3">{splitSpeech(line).headline}</span>
        }
        titleKey={line}
        live
        detail={asked}
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
              className="size-2.5 fill-current"
            />
            Stop
          </Button>
        }
      />
    )
  }

  if (phase === "error") {
    return (
      <div role="alert" className="flex flex-1 flex-col">
        <HeroLayout
          visual={visual}
          title={session.errorText}
          detail={asked}
          dock={
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button size="cta" onClick={session.retry}>
                <RotateCcw aria-hidden data-icon="inline-start" />
                Try again
              </Button>
              <Button
                size="cta"
                variant="outline"
                className="w-auto"
                nativeButton={false}
                render={<Link href="/assessments" />}
              >
                <Gamepad2 aria-hidden data-icon="inline-start" />
                Games
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const { headline, rest } = splitSpeech(session.spoken ?? "Where next?")

  return (
    <HeroLayout
      visual={visual}
      eyebrow={
        <div className="flex min-h-5 items-center justify-between gap-3">
          <ActiveThread investigations={snapshot.open} />
          <DecisionLog decisions={snapshot.log} />
        </div>
      }
      title={<span className="line-clamp-4">{headline}</span>}
      detail={rest ? <SpokenDetail headline={headline} rest={rest} /> : asked}
      dock={
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button size="cta" onClick={session.keepGoing}>
            Continue
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
          <Sheet
            title="Ask"
            trigger={(open) => (
              <Button
                size="cta"
                variant="outline"
                className="w-auto"
                onClick={open}
              >
                <MessageCircle aria-hidden data-icon="inline-start" />
                Ask
              </Button>
            )}
          >
            {(close) => (
              <Composer
                onAsk={(text) => {
                  close()
                  session.ask(text)
                }}
              />
            )}
          </Sheet>
        </div>
      }
    />
  )
}

/** The rest of what the agent said: quiet, and never long enough to shift the page. */
function SpokenDetail({ headline, rest }: { headline: string; rest: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">
        {rest}
      </p>
      {rest.length > LONG_DETAIL_CHARS ? (
        <Sheet
          title="In full"
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="rounded text-sm underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Read more
            </button>
          )}
        >
          <div className="flex flex-col gap-3">
            <p className="voice-title text-pretty">{headline}</p>
            <p className="text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">
              {rest}
            </p>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}

/** The investigation in progress, with how much of its evidence is in. */
function ActiveThread({
  investigations,
}: {
  investigations: readonly InvestigationSummary[]
}) {
  const running = investigations.filter(({ status }) => status === "active")
  const active = running[0]
  if (!active) return <span />
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
      className="flex min-w-0 items-center gap-2 rounded-full text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg
        viewBox="0 0 36 36"
        aria-hidden
        className="size-4 shrink-0 -rotate-90"
      >
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="var(--glow)"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${progress * 100} 100`}
        />
      </svg>
      <span className="truncate">{active.title}</span>
      {running.length > 1 ? (
        <span className="shrink-0 text-xs tabular-nums">
          +{running.length - 1}
        </span>
      ) : null}
      <span className="sr-only">
        {Math.round(progress * 100)}% of evidence collected
      </span>
      <ChevronRight aria-hidden className="size-3.5 shrink-0" />
    </Link>
  )
}
