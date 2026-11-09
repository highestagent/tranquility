"use client"
import { useEffect, useRef, useState } from "react"
import { ConversationCanvas } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { InteractionRenderer } from "@/modules/interaction/renderer"
import { questionInteraction, type Answer } from "@/modules/interaction/catalog"
import { getQuestion, type QuestionId } from "./bank"
import { loadSessionAnswers, saveAnswer, type Answers } from "./responses"

export function QuestionFlow({
  questionIds,
  sessionId,
  eyebrow,
  recordDeclines = true,
  onDone,
}: {
  questionIds: readonly QuestionId[]
  sessionId?: string
  eyebrow?: React.ReactNode
  recordDeclines?: boolean
  onDone: (answered: number) => void | Promise<void>
}) {
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  async function load() {
    try {
      const restored = await loadSessionAnswers(questionIds, sessionId)
      setError(false)
      setAnswers(restored)
      const next = questionIds.findIndex((id) => !(id in restored))
      setIndex(next === -1 ? questionIds.length : next)
    } catch {
      setError(true)
    }
  }
  useEffect(() => {
    let active = true
    loadSessionAnswers(questionIds, sessionId).then(
      (restored) => {
        if (!active) return
        setError(false)
        setAnswers(restored)
        const next = questionIds.findIndex((id) => !(id in restored))
        setIndex(next === -1 ? questionIds.length : next)
      },
      () => {
        if (active) setError(true)
      }
    )
    return () => {
      active = false
    }
  }, [questionIds, sessionId])
  useEffect(() => {
    if (answers && index === questionIds.length && !lock.current) {
      lock.current = true
      Promise.resolve(
        done.current(questionIds.filter((id) => answers[id] != null).length)
      )
        .catch(() => setError(true))
        .finally(() => {
          lock.current = false
        })
    }
  }, [answers, index, questionIds])
  const id = questionIds[index]
  const question = id ? getQuestion(id) : null
  async function answer(value: Answer) {
    if (!id || !answers || lock.current) return
    lock.current = true
    setBusy(true)
    setError(false)
    const numeric =
      typeof value === "boolean"
        ? Number(value)
        : typeof value === "number"
          ? value
          : null
    try {
      if (numeric !== null || recordDeclines)
        await saveAnswer(id, numeric, sessionId)
      setAnswers({ ...answers, [id]: numeric })
      setIndex(index + 1)
    } catch {
      setError(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <ConversationCanvas
      stage={question ? `Your ${question.domain}` : "Your context"}
      message={question?.prompt ?? "Restoring your progress…"}
    >
      {eyebrow ? (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Why I’m asking</summary>
          <div className="mt-3">{eyebrow}</div>
        </details>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm">
          Your progress could not be saved or restored. Please retry; this
          question has not advanced.
        </p>
      ) : null}
      {question && answers ? (
        <>
          <InteractionRenderer
            key={id}
            interaction={questionInteraction(question)}
            disabled={busy}
            onAnswer={(value) => void answer(value)}
          />
          <div className="flex justify-between">
            <Button
              variant="ghost"
              disabled={busy || index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Back
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void answer(null)}
            >
              Skip
            </Button>
          </div>
        </>
      ) : error ? (
        <Button onClick={() => void load()}>Retry</Button>
      ) : null}
    </ConversationCanvas>
  )
}
