"use client"
import { useState } from "react"
import { ConversationCanvas } from "@/components/screen"
import { Sheet } from "@/components/sheet"
import { StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { AssessmentRunner } from "@/modules/assessments/runner/assessment-runner"
import { QuestionFlow } from "@/modules/questionnaire/question-flow"
import { isDisplayOnly } from "@/modules/interaction/catalog"
import { InteractionRenderer } from "@/modules/interaction/renderer"
import { Composer } from "./composer"
import { ResumeNote } from "./resume-note"
import { TaskInvitation } from "./task-invitation"
import { useAgentSession } from "./use-agent-session"

export function HomeLoading() {
  return (
    <ConversationCanvas
      message="One moment…"
      stage="Restoring your progress"
      busy
    />
  )
}
export function AgentHome() {
  const session = useAgentSession()
  const { phase, pending, snapshot, activity } = session
  const [running, setRunning] = useState<string | null>(null)
  if (phase === "storage-error")
    return <StorageError onRetry={session.reload} />
  if (phase === "loading" || !snapshot) return <HomeLoading />
  const ask = (
    <Sheet
      title="Ask Tranquility"
      trigger={<Button variant="outline">Ask</Button>}
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
  )
  // The visit's first task waits to be opened, so a return starts with a hello.
  if (phase === "invited" && pending)
    return (
      <ConversationCanvas
        stage="Ready when you are"
        message={session.greeting}
        controls={
          <>
            <Button onClick={session.start}>Start</Button>
            {ask}
          </>
        }
      >
        {snapshot.resume ? <ResumeNote resume={snapshot.resume} /> : null}
        <TaskInvitation task={pending} />
      </ConversationCanvas>
    )
  if (
    phase === "playing" &&
    pending?.kind === "assessment" &&
    running === pending.id
  )
    return (
      <AssessmentRunner
        key={pending.id}
        runId={pending.id}
        assessmentId={pending.assessmentId}
        onFinish={session.finishAssessment}
        doneLabel="Return to conversation"
      />
    )
  if (phase === "asking" && pending?.kind === "questions")
    return (
      <>
        <QuestionFlow
          key={pending.id}
          questionIds={pending.questionIds}
          sessionId={pending.sessionId}
          eyebrow={pending.reason}
          onDone={session.finishQuestions}
        />
        <div className="mx-auto w-full max-w-lg pb-6">{ask}</div>
      </>
    )
  if (phase === "interaction" && pending?.kind === "interaction") {
    // Something to look at, not a question, so there's nothing to skip.
    const showing = isDisplayOnly(pending.interaction)
    return (
      <ConversationCanvas
        message={pending.message}
        why={pending.reason}
        whyLabel={showing ? "Why I’m showing this" : undefined}
        controls={
          <>
            {ask}
            {showing ? null : (
              <Button
                variant="ghost"
                onClick={() => session.finishInteraction(null)}
              >
                Skip
              </Button>
            )}
          </>
        }
      >
        <InteractionRenderer
          key={pending.id}
          interaction={pending.interaction}
          onAnswer={session.finishInteraction}
        />
        {showing ? (
          <Button onClick={() => session.finishInteraction(true)}>
            Continue
          </Button>
        ) : null}
      </ConversationCanvas>
    )
  }
  if (phase === "playing" && pending?.kind === "assessment")
    return (
      <ConversationCanvas
        stage="A useful next measurement"
        message={pending.reason}
        why="Measurements help compare your cognitive performance with context collected in this session. A single result cannot establish a diagnosis or a causal relationship."
        controls={
          <>
            {ask}
            <Button
              variant="ghost"
              onClick={() => session.finishAssessment(null)}
            >
              Not now
            </Button>
          </>
        }
      >
        <InteractionRenderer
          interaction={{
            type: "AssessmentCard",
            props: { assessmentId: pending.assessmentId },
          }}
          onAnswer={() => setRunning(pending.id)}
        />
      </ConversationCanvas>
    )
  if (phase === "reveal") {
    const finding = snapshot.unseen[0]!
    return (
      <ConversationCanvas
        stage="An observation"
        message="Here’s what the evidence suggests."
        why="I show each new finding once, as soon as it’s recorded, so none slips past. Details has the numbers behind it."
        whyLabel="Why I’m showing this"
        controls={
          <>
            <Button onClick={() => void session.dismissDiscovery()}>
              Continue
            </Button>
            {ask}
          </>
        }
      >
        <InteractionRenderer
          interaction={{
            type: "EvidenceCard",
            props: { discoveryId: finding.id },
          }}
          onAnswer={() => {}}
        />
        <p className="text-sm text-muted-foreground">
          An association does not establish cause and effect.
        </p>
      </ConversationCanvas>
    )
  }
  if (phase === "error")
    return (
      <ConversationCanvas
        stage="Conversation paused"
        message={session.errorText}
        controls={
          <>
            <Button onClick={session.retry}>Retry</Button>
            {ask}
          </>
        }
      >
        <p className="text-muted-foreground">
          Your saved progress is still here. I’ll continue from it when the
          connection is available.
        </p>
      </ConversationCanvas>
    )
  if (phase === "thinking")
    return (
      <ConversationCanvas
        stage={activity.caption ?? "Considering your context"}
        busy
        message={activity.spoken ?? session.startingLine}
        controls={
          <>
            <Button variant="ghost" onClick={session.stop}>
              Pause
            </Button>
            {ask}
          </>
        }
      />
    )
  return (
    <ConversationCanvas
      stage="At rest"
      message={session.spoken ?? "What would you like to explore?"}
      controls={
        <>
          {ask}
          <Button variant="ghost" onClick={session.keepGoing}>
            Continue our research
          </Button>
        </>
      }
    >
      {snapshot.resume ? (
        <ResumeNote resume={snapshot.resume} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your research is saved. There’s no need to measure again until it
          would add useful evidence.
        </p>
      )}
    </ConversationCanvas>
  )
}
