"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { randomSeed } from "@/lib/random"
import {
  getCurrentSession,
  measurements,
  newId,
  type Measurement,
} from "@/modules/memory"

import { getAssessment } from "../registry"
import type { AssessmentDefinition, MetricDefinition } from "../types"

/** Practice stimuli stay the same each time, so they never leak into tests. */
const PRACTICE_SEED = 20240229

type Stage =
  | { name: "intro" }
  | { name: "practice" }
  | { name: "ready" }
  | { name: "test"; seed: number; startedAt: number }
  | { name: "saving" }
  | { name: "result"; measurement: Measurement }
  | { name: "error" }

export interface AssessmentRunnerProps {
  assessmentId: string
  /** Called with the saved run, or `null` if the user stopped before the end. */
  onFinish?: (measurement: Measurement | null) => void
  doneLabel?: string
}

type InputType = Measurement["inputType"]

export function AssessmentRunner({
  assessmentId,
  onFinish,
  doneLabel = "Done",
}: AssessmentRunnerProps) {
  const assessment = getAssessment(assessmentId)
  if (!assessment) throw new Error(`Unknown assessment: ${assessmentId}`)

  const [stage, setStage] = useState<Stage>({ name: "intro" })
  const inputType = useRef<InputType>("unknown")

  async function save(
    test: Extract<Stage, { name: "test" }>,
    trials: unknown[],
    invalidReason?: string
  ) {
    setStage({ name: "saving" })
    try {
      const session = await getCurrentSession()
      const measurement = await measurements.put({
        id: newId(),
        sessionId: session.id,
        assessmentId: assessment!.id,
        protocolVersion: assessment!.protocolVersion,
        seed: test.seed,
        startedAt: test.startedAt,
        completedAt: Date.now(),
        inputType: inputType.current,
        valid: !invalidReason,
        invalidReason,
        trials,
        metrics: invalidReason ? {} : assessment!.score(trials as never[]),
      })
      setStage({ name: "result", measurement })
    } catch {
      setStage({ name: "error" })
    }
  }

  const test = stage.name === "test" ? stage : null
  useRunGuards(test !== null, inputType, () => {
    if (test) void save(test, [], "The tab lost focus during the run.")
  })

  const Game = assessment.Game

  return (
    <section
      aria-label={assessment.name}
      className="flex flex-col gap-4 border border-border p-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-medium">{assessment.name}</h2>
          <p className="text-sm text-muted-foreground">{assessment.measures}</p>
        </div>
        {stage.name === "practice" || stage.name === "test" ? (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setStage({ name: "intro" })
              onFinish?.(null)
            }}
          >
            Stop
          </Button>
        ) : null}
      </div>

      {stage.name === "intro" ? (
        <div className="flex flex-col gap-4">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {assessment.instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            About {Math.ceil(assessment.approxSeconds / 60)} min. Stay on this
            tab, because switching away cancels the run.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => setStage({ name: "practice" })}>
              Start practice
            </Button>
            {onFinish ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => onFinish(null)}
              >
                Not now
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {stage.name === "practice" ? (
        <Game
          seed={PRACTICE_SEED}
          mode="practice"
          onComplete={() => setStage({ name: "ready" })}
        />
      ) : null}

      {stage.name === "ready" ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm">
            Practice complete. The real run is recorded and has no feedback.
          </p>
          <Button
            size="lg"
            onClick={() =>
              setStage({
                name: "test",
                seed: randomSeed(),
                startedAt: Date.now(),
              })
            }
          >
            Start run
          </Button>
        </div>
      ) : null}

      {stage.name === "test" ? (
        <Game
          key={stage.seed}
          seed={stage.seed}
          mode="test"
          onComplete={(trials) => void save(stage, trials)}
        />
      ) : null}

      {stage.name === "saving" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saving your run…
        </p>
      ) : null}

      {stage.name === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-sm">
          <p>
            This run couldn&apos;t be saved on this device. Check that browser
            storage is enabled, then try again.
          </p>
          <Button size="lg" onClick={() => setStage({ name: "intro" })}>
            Try again
          </Button>
        </div>
      ) : null}

      {stage.name === "result" ? (
        <RunResult
          assessment={assessment}
          measurement={stage.measurement}
          doneLabel={doneLabel}
          onRetry={() => setStage({ name: "ready" })}
          onDone={() => {
            if (onFinish) onFinish(stage.measurement)
            else setStage({ name: "intro" })
          }}
        />
      ) : null}
    </section>
  )
}

/** Tracks the input device and reports the tab being hidden during a run. */
function useRunGuards(
  active: boolean,
  inputTypeRef: React.RefObject<InputType>,
  onHidden: () => void
) {
  const latestOnHidden = useRef(onHidden)
  useEffect(() => {
    latestOnHidden.current = onHidden
  })

  useEffect(() => {
    if (!active) return
    inputTypeRef.current = "unknown"

    const onKey = () => {
      inputTypeRef.current = "keyboard"
    }
    const onPointer = (event: PointerEvent) => {
      inputTypeRef.current = event.pointerType === "touch" ? "touch" : "pointer"
    }
    const onVisibility = () => {
      if (document.hidden) latestOnHidden.current()
    }

    window.addEventListener("keydown", onKey, { capture: true })
    window.addEventListener("pointerdown", onPointer, { capture: true })
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true })
      window.removeEventListener("pointerdown", onPointer, { capture: true })
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [active, inputTypeRef])
}

function formatMetric(value: number, metric: MetricDefinition) {
  switch (metric.unit) {
    case "ms":
      return `${Math.round(value)} ms`
    case "ms/item":
      return `${value.toFixed(1)} ms/item`
    case "ratio":
      return `${Math.round(value * 100)}%`
    case "count":
      return String(Math.round(value))
    case "index":
      return value.toFixed(2)
  }
}

function RunResult({
  assessment,
  measurement,
  doneLabel,
  onRetry,
  onDone,
}: {
  assessment: AssessmentDefinition<never>
  measurement: Measurement
  doneLabel: string
  onRetry: () => void
  onDone: () => void
}) {
  if (!measurement.valid) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 text-sm">
        <p>
          This run was cancelled and won&apos;t be used in any analysis.{" "}
          {measurement.invalidReason}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={onRetry}>
            Run again
          </Button>
          <Button size="lg" variant="outline" onClick={onDone}>
            {doneLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {assessment.metrics.flatMap((metric) => {
          const value = measurement.metrics[metric.id]
          if (value === undefined) return []
          return (
            <div key={metric.id}>
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="font-mono text-sm tabular-nums">
                {formatMetric(value, metric)}
              </dd>
            </div>
          )
        })}
      </dl>
      <Button size="lg" onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  )
}
