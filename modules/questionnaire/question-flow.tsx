"use client"

import { ArrowRight, Check, ChevronLeft, SkipForward, X } from "lucide-react"
import { createElement, useEffect, useRef, useState } from "react"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  getQuestion,
  SCALE_POINTS,
  validateAnswer,
  type Question,
  type QuestionId,
} from "./bank"
import { getQuestionIcon } from "./domains"
import { loadSessionAnswers, saveAnswer, type Answers } from "./responses"

/** How long a tapped answer stays visible before the next question appears. */
const ADVANCE_DELAY_MS = 220

/**
 * One question at a time, with the answers in thumb reach. A tap answers and
 * moves on. Each answer is saved straight away, so closing the page loses
 * nothing and the flow picks up where it left off.
 *
 * `recordDeclines` is for when the agent asked. A check-in the user opened
 * themselves has declined nothing by leaving it.
 */
export function QuestionFlow({
  questionIds,
  eyebrow,
  recordDeclines = true,
  onDone,
}: {
  questionIds: readonly QuestionId[]
  eyebrow?: React.ReactNode
  recordDeclines?: boolean
  onDone: (answered: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  // Tapped answers wait briefly before advancing. Further taps are ignored.
  const advancing = useRef(false)
  const finishing = useRef(false)

  const id = questionIds[index]
  const question = id ? (getQuestion(id) as Question) : null

  async function finish(final: Answers) {
    if (finishing.current) return
    finishing.current = true
    setSaving(true)
    setSaveFailed(false)
    try {
      if (recordDeclines) {
        await Promise.all(
          questionIds
            .filter((questionId) => !(questionId in final))
            .map((questionId) => saveAnswer(questionId, null))
        )
      }
      onDone(
        questionIds.filter(
          (questionId) =>
            final[questionId] !== null && final[questionId] !== undefined
        ).length
      )
    } catch {
      finishing.current = false
      setSaveFailed(true)
      setSaving(false)
    }
  }

  const resume = (restored: Answers) => {
    setAnswers(restored)
    const next = questionIds.findIndex(
      (questionId) => !(questionId in restored)
    )
    if (next === -1) void finish(restored)
    else setIndex(next)
  }
  const resumeRef = useRef(resume)
  useEffect(() => {
    resumeRef.current = resume
  })

  useEffect(() => {
    let active = true
    loadSessionAnswers(questionIds).then(
      (restored) => {
        if (active) resumeRef.current(restored)
      },
      () => {
        if (active) resumeRef.current({})
      }
    )
    return () => {
      active = false
    }
  }, [questionIds])

  function answer(value: number | null, delay = 0) {
    if (!id || !answers || advancing.current) return
    advancing.current = true
    const next = { ...answers, [id]: value }
    // A skip in a check-in isn't a decline: it just moves on.
    if (value === null && !recordDeclines) delete next[id]
    setAnswers(next)
    if (value !== null || recordDeclines) {
      saveAnswer(id, value).catch(() => setSaveFailed(true))
    }
    setTimeout(() => {
      advancing.current = false
      if (index + 1 < questionIds.length) setIndex(index + 1)
      else void finish(next)
    }, delay)
  }

  if (saveFailed) {
    return (
      <div role="alert" className="flex flex-1 flex-col">
        <Screen
          title="I couldn't save that on this device."
          dock={
            <Button size="cta" onClick={() => void finish(answers ?? {})}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }
  if (!question || !id || !answers) return null

  return (
    <section
      aria-label={`Question ${index + 1} of ${questionIds.length}`}
      className="flex flex-1 flex-col"
    >
      <div className="flex items-center gap-3 pb-3">
        <ol aria-hidden className="flex flex-1 gap-1">
          {questionIds.map((questionId, segment) => (
            <li
              key={questionId}
              className={cn(
                "h-1 flex-1 rounded-full bg-border transition-colors duration-300",
                segment <= index && "bg-primary"
              )}
            />
          ))}
        </ol>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Skip the rest"
          title="Skip the rest"
          className="-mr-2"
          disabled={saving}
          onClick={() => void finish(answers)}
        >
          <X aria-hidden />
        </Button>
      </div>

      <Screen
        eyebrow={eyebrow}
        title={question.prompt}
        titleKey={id}
        dock={
          <div key={id} className="rise-in flex flex-col gap-3">
            <AnswerControl
              question={question}
              value={answers[id] ?? null}
              disabled={saving}
              onPick={(value) => answer(value, ADVANCE_DELAY_MS)}
              onSubmit={(value) => answer(value)}
            />
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="lg"
                className={cn(
                  "-ml-2 text-muted-foreground",
                  index === 0 && "invisible"
                )}
                disabled={index === 0 || saving}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft aria-hidden data-icon="inline-start" />
                Back
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="-mr-2 text-muted-foreground"
                disabled={saving}
                onClick={() => answer(null)}
              >
                Skip
                <SkipForward aria-hidden data-icon="inline-end" />
              </Button>
            </div>
          </div>
        }
      >
        <span className="m-auto flex size-28 items-center justify-center rounded-full bg-muted">
          {createElement(getQuestionIcon(question), {
            "aria-hidden": true,
            className: "size-11",
            strokeWidth: 1.5,
          })}
        </span>
      </Screen>
    </section>
  )
}

function AnswerControl({
  question,
  value,
  disabled,
  onPick,
  onSubmit,
}: {
  question: Question
  value: number | null
  disabled: boolean
  onPick: (value: number) => void
  onSubmit: (value: number) => void
}) {
  const { kind } = question
  if (kind.type === "scale") {
    return (
      <ScalePicker
        low={kind.low}
        high={kind.high}
        value={value}
        disabled={disabled}
        onPick={onPick}
      />
    )
  }
  if (kind.type === "yes-no") {
    return <YesNoPicker value={value} disabled={disabled} onPick={onPick} />
  }
  return (
    <NumberDial
      question={question}
      min={kind.min}
      max={kind.max}
      step={kind.step}
      unit={kind.unit}
      initial={value}
      disabled={disabled}
      onSubmit={onSubmit}
    />
  )
}

/** Five growing circles, so the scale reads before its labels do. */
function ScalePicker({
  low,
  high,
  value,
  disabled,
  onPick,
}: {
  low: string
  high: string
  value: number | null
  disabled: boolean
  onPick: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="-mx-1 flex items-center justify-between">
        {SCALE_POINTS.map((point) => {
          const size = 1.25 + point * 0.4
          const selected = value === point
          return (
            <button
              key={point}
              type="button"
              disabled={disabled}
              aria-label={`${point} of 5: ${point === 1 ? low : point === 5 ? high : "between"}`}
              aria-pressed={selected}
              onClick={() => onPick(point)}
              className="group flex size-14 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "rounded-full border-2 border-primary/50 transition-all duration-200 group-hover:border-primary group-active:scale-90",
                  selected && "border-primary bg-primary"
                )}
                style={{ width: `${size}rem`, height: `${size}rem` }}
              />
            </button>
          )
        })}
      </div>
      <p className="flex justify-between gap-4 text-xs text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  )
}

function YesNoPicker({
  value,
  disabled,
  onPick,
}: {
  value: number | null
  disabled: boolean
  onPick: (value: number) => void
}) {
  const options = [
    { value: 1, label: "Yes", Icon: Check },
    { value: 0, label: "No", Icon: X },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onPick(option.value)}
            className={cn(
              "flex h-24 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-border bg-card text-sm font-medium transition-all duration-200 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
              selected && "border-primary bg-primary text-primary-foreground"
            )}
          >
            <option.Icon aria-hidden className="size-6" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The thumb stays hidden until first touched, so a preset value can't anchor
 * the answer, which would bias the measurement.
 */
function NumberDial({
  question,
  min,
  max,
  step,
  unit,
  initial,
  disabled,
  onSubmit,
}: {
  question: Question
  min: number
  max: number
  step: number
  unit: string
  initial: number | null
  disabled: boolean
  onSubmit: (value: number) => void
}) {
  const [value, setValue] = useState<number | null>(initial)
  const midpoint = Math.round((min + max) / 2 / step) * step
  const error = value === null ? null : validateAnswer(question, value)

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2" aria-live="polite">
        <span className="font-mono text-4xl tabular-nums">
          {value === null ? "–" : value}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </p>
      <input
        type="range"
        aria-label={question.prompt}
        min={min}
        max={max}
        step={step}
        value={value ?? midpoint}
        disabled={disabled}
        data-touched={value !== null || undefined}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={(event) => setValue(Number(event.currentTarget.value))}
        className="dial h-11 w-full cursor-pointer accent-primary"
      />
      <Button
        size="cta"
        disabled={disabled || value === null || error !== null}
        onClick={() => {
          if (value !== null) onSubmit(value)
        }}
      >
        Next
        <ArrowRight aria-hidden data-icon="inline-end" />
      </Button>
    </div>
  )
}
