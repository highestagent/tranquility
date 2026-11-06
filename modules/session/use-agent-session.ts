"use client"

import { useChat } from "@ai-sdk/react"
import { DirectChatTransport } from "ai"
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"

import { createInvestigationAgent } from "@/modules/agent/agent"
import { createBrowserModel } from "@/modules/agent/model"
import { clearPendingTask } from "@/modules/agent/pending-task"
import { loadKnowledge } from "@/modules/insights/knowledge"
import type { Measurement } from "@/modules/memory"

import { deriveActivity } from "./activity"
import * as auto from "./messages"
import { loadSnapshot, type Snapshot } from "./snapshot"
import { setAgentRest, setSeenDiscoveriesAt, shouldWake } from "./wake"

export type Phase =
  | "loading"
  | "storage-error"
  | "thinking"
  | "error"
  | "reveal"
  | "asking"
  | "playing"
  | "resting"

function describeError(error: unknown) {
  const text = error instanceof Error ? error.message : ""
  if (/too many requests/i.test(text))
    return "Too many requests. Give me a minute."
  if (/isn't configured/i.test(text))
    return "Cloud AI isn't set up on this server."
  if (/free tier/i.test(text)) return "This model needs paid AI credits."
  if (/credit card|credits|billing/i.test(text))
    return "AI billing needs attention."
  return "I can't reach my model right now."
}

/**
 * The agent's life on this device. It restores state, wakes itself when there's
 * a reason to, and reports one phase, which is what the screen shows.
 */
export function useAgentSession() {
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

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [turnActive, setTurnActive] = useState(false)
  const [turnsEnded, setTurnsEnded] = useState(0)

  const activity = useMemo(() => deriveActivity(messages), [messages])

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await loadSnapshot())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  async function runTurn(send: () => Promise<void>) {
    setTurnActive(true)
    try {
      await send()
    } finally {
      setTurnActive(false)
      setTurnsEnded((count) => count + 1)
    }
  }

  function sendHidden(text: string) {
    return runTurn(() => sendMessage({ text, metadata: { hidden: true } }))
  }

  const boot = useEffectEvent(async () => {
    try {
      const restored = await loadSnapshot()
      setSnapshot(restored)
      if (
        !restored.pending &&
        restored.unseen.length === 0 &&
        shouldWake({
          rest: restored.rest,
          latestDataAt: restored.latestDataAt,
          now: Date.now(),
        })
      ) {
        void sendHidden(auto.SESSION_START)
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

  // Threads appear on the map as the agent works, not only when it's done.
  const { completedTools } = activity
  useEffect(() => {
    if (completedTools === 0) return
    loadKnowledge().then(
      (knowledge) => setSnapshot((old) => (old ? { ...old, knowledge } : old)),
      () => undefined
    )
  }, [completedTools])

  const rememberTurn = useEffectEvent(async () => {
    if (!error) {
      await setAgentRest({ at: Date.now(), spoken: activity.spoken })
    }
  })
  useEffect(() => {
    if (turnsEnded === 0) return
    rememberTurn()
      .then(loadSnapshot)
      .then(setSnapshot, () => setLoadFailed(true))
  }, [turnsEnded])

  async function finishTask(text: string) {
    setTurnActive(true)
    await clearPendingTask()
    setSnapshot((old) => (old ? { ...old, pending: null } : old))
    await sendHidden(text)
  }

  const pending = snapshot?.pending ?? null
  const busy = status === "submitted" || status === "streaming"

  let phase: Phase
  if (loadFailed) phase = "storage-error"
  else if (!snapshot) phase = "loading"
  else if (turnActive || busy) phase = "thinking"
  else if (error) phase = "error"
  else if (snapshot.unseen.length > 0) phase = "reveal"
  else if (pending?.kind === "questions") phase = "asking"
  else if (pending?.kind === "assessment") phase = "playing"
  else phase = "resting"

  return {
    phase,
    activity,
    snapshot,
    pending,
    spoken: activity.spoken ?? snapshot?.rest?.spoken ?? null,
    errorText: error ? describeError(error) : null,
    retry: () => void runTurn(() => regenerate()),
    reload: () => void refresh(),
    stop: () => void stop(),
    keepGoing: () => void sendHidden(auto.CONTINUE),
    ask: (text: string) => void runTurn(() => sendMessage({ text })),
    finishQuestions: (answered: number) => {
      if (pending?.kind !== "questions") return
      void finishTask(
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
    dismissDiscovery: () => {
      const seen = snapshot?.unseen[0]
      if (!seen) return
      void setSeenDiscoveriesAt(seen.discovery.createdAt)
      setSnapshot((old) =>
        old ? { ...old, unseen: old.unseen.slice(1) } : old
      )
    },
  }
}
