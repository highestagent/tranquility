"use client"

import { useId, useState } from "react"

import { Button } from "@/components/ui/button"

import {
  getQuestion,
  SCALE_POINTS,
  validateAnswer,
  type Question,
  type QuestionId,
} from "./bank"
import { saveAnswers } from "./responses"

export function QuestionnaireForm({
  questionIds,
  onDone,
  submitLabel = "Save answers",
}: {
  questionIds: readonly QuestionId[]
  onDone: (answered: number) => void
  submitLabel?: string
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const answers: Partial<Record<QuestionId, number | null>> = {}
    let answered = 0

    for (const id of questionIds) {
      const raw = values[id]?.trim()
      if (!raw) {
        answers[id] = null
        continue
      }
      const value = Number(raw)
      const error = validateAnswer(getQuestion(id)!, value)
      if (error) nextErrors[id] = error
      else {
        answers[id] = value
        answered++
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setSaveFailed(false)
    try {
      await saveAnswers(answers)
      onDone(answered)
    } catch {
      setSaveFailed(true)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5 border border-border p-4"
    >
      <p className="text-sm text-muted-foreground">
        Leave anything blank to skip it.
      </p>
      {questionIds.map((id) => (
        <QuestionField
          key={id}
          question={getQuestion(id)!}
          value={values[id] ?? ""}
          error={errors[id]}
          onChange={(value) => setValues((old) => ({ ...old, [id]: value }))}
        />
      ))}
      {saveFailed ? (
        <p role="alert" className="text-sm text-destructive">
          Your answers couldn&apos;t be saved. Check that browser storage is
          enabled, then try again.
        </p>
      ) : null}
      <Button size="lg" type="submit" disabled={saving} className="self-start">
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}

function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: Question
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const { kind } = question
  const errorId = `${id}-error`

  if (kind.type === "number") {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {question.prompt}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            autoComplete="off"
            min={kind.min}
            max={kind.max}
            step={kind.step}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-24 border border-input bg-transparent px-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive sm:text-sm"
          />
          <span className="text-sm text-muted-foreground">{kind.unit}</span>
        </div>
        {error ? (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  const options =
    kind.type === "scale"
      ? SCALE_POINTS.map((point) => ({
          value: String(point),
          label: String(point),
        }))
      : [
          { value: "1", label: "Yes" },
          { value: "0", label: "No" },
        ]

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{question.prompt}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex h-10 min-w-12 cursor-pointer items-center justify-center border border-input px-3 text-sm select-none has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              // Clicking the chosen option again clears it, so it can be skipped.
              onClick={() => {
                if (value === option.value) onChange("")
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {kind.type === "scale" ? (
        <p className="flex max-w-64 justify-between gap-4 text-xs text-muted-foreground">
          <span>1 = {kind.low}</span>
          <span>5 = {kind.high}</span>
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
  )
}
