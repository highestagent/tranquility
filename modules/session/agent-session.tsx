"use client"

import { useChat } from "@ai-sdk/react"
import { DirectChatTransport } from "ai"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { createInvestigationAgent } from "@/modules/agent/agent"
import { createBrowserModel } from "@/modules/agent/model"
import {
  clearPendingTask,
  getPendingTask,
  type PendingTask,
} from "@/modules/agent/pending-task"
import {
  getInvestigationState,
  type InvestigationSummary,
} from "@/modules/investigation"
import { decisions as decisionLog, type Decision } from "@/modules/memory"

import { AgentMessages } from "./agent-messages"
import { DecisionLog } from "./decision-log"
import * as auto from "./messages"
import { PendingTaskCard } from "./pending-task-card"

const SESSION_DECISIONS = 30

function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : ""
  if (/too many requests/i.test(text)) {
    return "The agent has had too many requests. Wait a minute, then try again."
  }
  if (/isn't configured/i.test(text)) {
    return "Cloud AI isn't set up on this server."
  }
  if (/free tier/i.test(text)) {
    return "This model needs paid AI Gateway credits on the account this server uses."
  }
  if (/credit card|credits|billing/i.test(text)) {
    return "The AI service needs billing set up on the account this server uses."
  }
  return "The agent couldn't respond. Your data is safe on this device."
}

export function AgentSession() {
  const [transport] = useState(
    () =>
      new DirectChatTransport({
        agent: createInvestigationAgent(createBrowserModel()),
        onError: (error) =>
          error instanceof Error ? error.message : "Unknown error",
      })
  )
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
  })
  const busy = status === "submitted" || status === "streaming"

  const [pending, setPending] = useState<PendingTask | null>(null)
  const [open, setOpen] = useState<InvestigationSummary[]>([])
  const [recent, setRecent] = useState<Decision[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [question, setQuestion] = useState("")

  const refresh = useCallback(async () => {
    try {
      const [task, state, log] = await Promise.all([
        getPendingTask(),
        getInvestigationState(),
        decisionLog.recent(SESSION_DECISIONS),
      ])
      setPending(task)
      setOpen(state.open)
      setRecent(log)
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [])

  // IndexedDB is the source of truth, so re-read it whenever a turn ends.
  const wasBusy = useRef(false)
  useEffect(() => {
    if (!busy && (wasBusy.current || !loaded)) void refresh()
    wasBusy.current = busy
  }, [busy, loaded, refresh])

  function sendHidden(text: string) {
    void sendMessage({ text, metadata: { hidden: true } })
  }

  async function finishTask(text: string) {
    await clearPendingTask()
    setPending(null)
    sendHidden(text)
  }

  const started = messages.length > 0
  const active = open.find(({ status: s }) => s === "active")

  if (!loaded) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Restoring your investigation…
      </p>
    )
  }
  if (loadFailed) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 text-sm">
        <p>Your investigation couldn&apos;t be read from this browser.</p>
        <Button size="lg" variant="outline" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {active && !started ? (
        <section
          aria-label="Current investigation"
          className="flex flex-col gap-1 border-l-2 border-primary pl-3 text-sm"
        >
          <p className="font-medium">{active.title}</p>
          <p className="text-muted-foreground">
            {active.progressNote || active.question}
          </p>
        </section>
      ) : null}

      <AgentMessages messages={messages} />

      {status === "submitted" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Thinking…
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-sm">
          <p>{errorMessage(error)}</p>
          <Button size="lg" variant="outline" onClick={() => void regenerate()}>
            Try again
          </Button>
        </div>
      ) : null}

      {pending && !busy ? (
        <PendingTaskCard
          task={pending}
          onQuestionsDone={(answered) => {
            if (pending.kind !== "questions") return
            void finishTask(
              auto.questionsFinished(answered, pending.questionIds.length)
            )
          }}
          onAssessmentDone={(measurement) => {
            if (pending.kind !== "assessment") return
            void finishTask(
              measurement?.valid
                ? auto.assessmentFinished(pending, measurement.id)
                : auto.assessmentDeclined(pending)
            )
          }}
        />
      ) : null}

      {!pending && !busy && !error ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            onClick={() =>
              sendHidden(started ? auto.CONTINUE : auto.SESSION_START)
            }
          >
            {started || active ? "Continue investigating" : "Start a session"}
          </Button>
        </div>
      ) : null}

      {busy ? (
        <Button
          size="lg"
          variant="outline"
          className="self-start"
          onClick={() => void stop()}
        >
          Stop
        </Button>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const text = question.trim()
          if (!text || busy) return
          setQuestion("")
          void sendMessage({ text })
        }}
      >
        <label htmlFor="ask-agent" className="text-sm font-medium">
          Ask your own question
        </label>
        <div className="flex gap-2">
          <input
            id="ask-agent"
            value={question}
            maxLength={500}
            autoComplete="off"
            placeholder="Does caffeine affect my concentration?"
            onChange={(event) => setQuestion(event.target.value)}
            className="h-10 min-w-0 flex-1 border border-input bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          />
          <Button
            size="lg"
            type="submit"
            variant="outline"
            className="h-10"
            disabled={busy || !question.trim()}
          >
            Ask
          </Button>
        </div>
      </form>

      <DecisionLog decisions={recent} />
    </div>
  )
}
