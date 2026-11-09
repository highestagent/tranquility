"use client"

import { useChat } from "@ai-sdk/react"
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"

import { onMemoryChange } from "@/modules/agent-memory/sync"
import { kv } from "@/modules/memory"
import { commitTask, getContinuation, CONTINUATION_KEY } from "./checkpoint"
import type { Answer } from "@/modules/interaction/catalog"
import type { Measurement } from "@/modules/memory"

import { deriveActivity } from "./activity"
import { getAgentChat, runAgentTurn } from "./agent-runtime"
import * as auto from "./messages"
import { loadSnapshot, type Snapshot } from "./snapshot"
import { setSeenDiscoveriesAt, shouldWake } from "./wake"

export type Phase =
  | "loading"
  | "storage-error"
  | "thinking"
  | "error"
  | "reveal"
  | "asking"
  | "playing"
  | "interaction"
  | "invited"
  | "resting"

/** Reopening the app this soon carries on with a task instead of greeting first. */
const RESUME_WITHIN_MS = 30 * 60 * 1000

/**
 * Whether the person has acted in this visit. Until they have, the agent's
 * first task waits behind a greeting rather than opening on its own. Kept for
 * the whole visit, so moving between pages doesn't reset it.
 */
let engagedThisVisit = false

function describeError(error: unknown) {
  const text = error instanceof Error ? error.message : ""
  if (/too many requests/i.test(text)) {
    return "Too many requests. Give me a minute."
  }
  if (/isn't configured/i.test(text)) {
    return "Cloud AI isn't set up on this server."
  }
  if (/free tier/i.test(text)) return "This model needs paid AI credits."
  if (/credit card|credits|billing/i.test(text)) {
    return "AI billing needs attention."
  }
  return "I can't reach my model right now."
}

/**
 * The agent as this screen sees it. It restores state, wakes the agent when
 * there's a reason to, and reports one phase, which is what the screen shows.
 */
export function useAgentSession() {
  const [chat] = useState(getAgentChat)
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    chat,
  })

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [engaged, setEngaged] = useState(engagedThisVisit)
  const engage = useCallback(() => {
    engagedThisVisit = true
    setEngaged(true)
  }, [])

  const activity = useMemo(() => deriveActivity(messages), [messages])
  const busy = status === "submitted" || status === "streaming"

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await loadSnapshot())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  /** `line` is what the screen says until the agent has something to say. */
  const activeTurn = useRef<Promise<void> | null>(null)
  const turning = useRef(false)
  async function runTurn(
    line: string,
    send: () => Promise<void>,
    interrupt = false
  ) {
    if (turning.current || (busy && !interrupt)) return
    turning.current = true
    setStarting(line)
    try {
      activeTurn.current = runAgentTurn(send)
      await activeTurn.current
    } catch {
      setLoadFailed(true)
    } finally {
      activeTurn.current = null
      turning.current = false
      setStarting(null)
    }
  }

  function sendContinuation(line: string, text: string) {
    return runTurn(line, async () => {
      await kv.set(CONTINUATION_KEY, text)
      await sendMessage({ text })
    })
  }

  const boot = useEffectEvent(async () => {
    try {
      const restored = await loadSnapshot()
      setSnapshot(restored)
      // Reloaded in the middle of something, so carry straight on.
      if (
        restored.pending &&
        Date.now() - restored.pending.createdAt < RESUME_WITHIN_MS
      ) {
        engage()
      }
      const continuation = await getContinuation()
      if (continuation && !busy && !restored.pending) {
        void sendContinuation("Picking up where we left off…", continuation)
        return
      }
      if (
        !busy &&
        !restored.pending &&
        restored.unseen.length === 0 &&
        (restored.taskExpired ||
          shouldWake({
            rest: restored.rest,
            latestDataAt: restored.latestDataAt,
            now: Date.now(),
          }))
      ) {
        void sendContinuation("Waking up…", auto.SESSION_START)
      }
    } catch {
      setLoadFailed(true)
    }
  })

  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void boot()
  }, [])

  // Another device can move the plan on or withdraw a finding at any time.
  useEffect(() => onMemoryChange(() => void refresh()), [refresh])

  // Storage is the source of truth, so re-read it whenever a turn ends. This
  // includes a turn that began before this screen did.
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy) {
      loadSnapshot().then(setSnapshot, () => setLoadFailed(true))
    }
    wasBusy.current = busy
  }, [busy])

  const finishing = useRef(false)
  async function finishTask(text: string, value?: Answer) {
    if (!snapshot?.pending || finishing.current) return
    finishing.current = true
    engage()
    try {
      await commitTask(snapshot.pending, text, value)
      setSnapshot((old) => (old ? { ...old, pending: null } : old))
      await sendContinuation("Taking that in…", text)
    } catch {
      setLoadFailed(true)
    } finally {
      finishing.current = false
    }
  }

  const pending = snapshot?.pending ?? null

  let phase: Phase
  if (loadFailed) phase = "storage-error"
  else if (!snapshot) phase = "loading"
  else if (starting || busy) phase = "thinking"
  else if (error) phase = "error"
  else if (snapshot.unseen.length > 0) phase = "reveal"
  else if (pending && !engaged) phase = "invited"
  else if (pending?.kind === "questions") phase = "asking"
  else if (pending?.kind === "assessment") phase = "playing"
  else if (pending?.kind === "interaction") phase = "interaction"
  else phase = "resting"

  return {
    phase,
    activity,
    snapshot,
    pending,
    /** Shown until the agent's own words arrive. */
    startingLine: starting ?? "One moment…",
    spoken: activity.spoken ?? snapshot?.rest?.spoken ?? null,
    /**
     * What the greeting says. Only this visit's words: a task ends the agent's
     * turn without any, and the last visit's parting line would contradict it.
     */
    greeting:
      activity.spoken ??
      (snapshot?.rest ? "Welcome back." : "Here’s a good first step."),
    errorText: error ? describeError(error) : null,
    retry: () => void runTurn("Trying again…", () => regenerate()),
    reload: () => void refresh(),
    stop: () => void stop(),
    keepGoing: () => {
      engage()
      void sendContinuation("Picking up the thread…", auto.CONTINUE)
    },
    /** Opens the task the greeting offered. */
    start: engage,
    ask: async (text: string) => {
      engage()
      await stop()
      await activeTurn.current?.catch(() => undefined)
      await runTurn(
        "Thinking about that…",
        async () => {
          await kv.set(CONTINUATION_KEY, text)
          await sendMessage({ text })
        },
        true
      )
    },
    finishInteraction: (value: Answer) =>
      void finishTask(
        "The user completed the current interaction. Read their saved personal context before continuing.",
        value
      ),
    finishQuestions: (answered: number) => {
      if (pending?.kind !== "questions") return
      return finishTask(
        auto.questionsFinished(answered, pending.questionIds.length)
      )
    },
    finishAssessment: (measurement: Measurement | null) => {
      if (pending?.kind !== "assessment") return
      void finishTask(
        measurement?.valid
          ? auto.assessmentFinished(pending, measurement.id)
          : auto.assessmentDeclined(pending)
      )
    },
    dismissDiscovery: async () => {
      const seen = snapshot?.unseen[0]
      if (!seen) return
      try {
        await setSeenDiscoveriesAt(seen.createdAt)
      } catch {
        setLoadFailed(true)
        return
      }
      setSnapshot((old) =>
        old ? { ...old, unseen: old.unseen.slice(1) } : old
      )
    },
  }
}
