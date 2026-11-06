"use client"

import { ArrowRight, Check, ChevronLeft, SkipForward, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  getQuestion,
  SCALE_POINTS,
  validateAnswer,
  type Question,
  type QuestionId,
} from "./bank"
import { getDomain } from "./domains"
import { saveAnswers } from "./responses"

/** How long a tapped answer stays visible before the next question appears. */
const ADVANCE_DELAY_MS = 220

type Answers = Partial<Record<QuestionId, number | null>>

/**
 * One question at a time. A tap answers and moves on, and anything skipped is
 * stored as declined.
 */
export function QuestionFlow({
  questionIds,
  onDone,
}: {
  questionIds: readonly QuestionId[]
  onDone: (answered: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const id = questionIds[index]
  const question = id ? (getQuestion(id) as Question) : null

  async function finish(final: Answers) {
    const complete: Answers = {}
    for (const questionId of questionIds) {
      complete[questionId] = final[questionId] ?? null
    }
    setSaving(true)
    setSaveFailed(false)
    try {
      await saveAnswers(complete)
      onDone(Object.values(complete).filter((value) => value !== null).length)
    } catch {
      setSaveFailed(true)
      setSaving(false)
    }
  }

  function answer(value: number | null, delay = 0) {
    if (!id) return
    const next = { ...answers, [id]: value }
    setAnswers(next)
    const advance = () => {
      if (index + 1 < questionIds.length) setIndex(index + 1)
      else void finish(next)
    }
    if (delay > 0) setTimeout(advance, delay)
    else advance()
  }

  if (saveFailed) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 py-8 text-sm"
      >
        <p>Couldn&apos;t save on this device.</p>
        <Button size="lg" onClick={() => void finish(answers)}>
          Try again
        </Button>
      </div>
    )
  }
  if (!question || !id) return null

  const { Icon } = getDomain(question.domain)

  return (
    <section
      aria-label={`Question ${index + 1} of ${questionIds.length}`}
      className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Previous question"
          disabled={index === 0 || saving}
          className={cn(index === 0 && "invisible")}
          onClick={() => setIndex(index - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <ol aria-hidden className="flex items-center gap-1.5">
          {questionIds.map((questionId, dot) => (
            <li
              key={questionId}
              className={cn(
                "size-1.5 rounded-full bg-border transition-all duration-300",
                dot < index && "bg-primary/50",
                dot === index && "w-5 bg-primary"
              )}
            />
          ))}
        </ol>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Skip the rest"
          title="Skip the rest"
          disabled={saving}
          onClick={() => void finish(answers)}
        >
          <X aria-hidden />
        </Button>
      </div>

      <div key={id} className="rise-in flex flex-col items-center gap-6">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Icon aria-hidden className="size-7" />
        </span>
        <h2 className="text-center font-voice text-2xl text-balance">
          {question.prompt}
        </h2>
        <AnswerControl
          key={id}
          question={question}
          value={answers[id] ?? null}
          disabled={saving}
          onPick={(value) => answer(value, ADVANCE_DELAY_MS)}
          onSubmit={(value) => answer(value)}
        />
      </div>

      <Button
        variant="ghost"
        size="lg"
        disabled={saving}
        className="self-center text-muted-foreground"
        onClick={() => answer(null)}
      >
        <SkipForward aria-hidden data-icon="inline-start" />
        Skip
      </Button>
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
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex items-center justify-between">
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
      <p className="flex justify-between gap-4 px-2 text-xs text-muted-foreground">
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
    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
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
              "flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border text-sm font-medium transition-all duration-200 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
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
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <p className="flex items-baseline gap-2" aria-live="polite">
        <span className="font-mono text-5xl tabular-nums">
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
        size="icon-lg"
        aria-label="Next"
        disabled={disabled || value === null || error !== null}
        onClick={() => {
          if (value !== null) onSubmit(value)
        }}
      >
        <ArrowRight aria-hidden />
      </Button>
    </div>
  )
}
