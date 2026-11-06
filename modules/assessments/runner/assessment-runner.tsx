"use client"

import { Clock, Play, X } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { randomSeed } from "@/lib/random"
import {
  getCurrentSession,
  measurements,
  newId,
  type Measurement,
} from "@/modules/memory"

import { getAssessment } from "../registry"
import { RunResult } from "./run-result"

/** Practice stimuli stay the same each time, so they never leak into tests. */
const PRACTICE_SEED = 20240229
const COUNTDOWN_STEP_MS = 800

type Stage =
  | { name: "intro" }
  | { name: "practice" }
  | { name: "ready" }
  | { name: "countdown" }
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
  const inputTypeRef = useRef<InputType>("unknown")

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
        inputType: inputTypeRef.current,
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
  useRunGuards(test !== null, inputTypeRef, () => {
    if (test) void save(test, [], "The tab lost focus during the run.")
  })

  const { Game, Preview, Icon } = assessment
  const inProgress =
    stage.name === "practice" ||
    stage.name === "countdown" ||
    stage.name === "test"

  return (
    <section
      aria-label={assessment.name}
      className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted">
            <Icon aria-hidden className="size-4.5" />
          </span>
          <h2 className="font-medium">{assessment.name}</h2>
        </div>
        {inProgress ? (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Stop"
            title="Stop"
            onClick={() => {
              setStage({ name: "intro" })
              onFinish?.(null)
            }}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      {stage.name === "intro" ? (
        <div className="rise-in flex flex-col gap-5">
          <Preview />
          <p className="text-center font-voice text-2xl text-balance">
            {assessment.tagline}
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={() => setStage({ name: "practice" })}>
                <Play aria-hidden data-icon="inline-start" />
                Try it
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
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock aria-hidden className="size-3.5" />
              {Math.ceil(assessment.approxSeconds / 60)} min · stay on this tab
            </p>
          </div>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer text-center text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Rules
            </summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {assessment.instructions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
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
        <div className="rise-in flex flex-col items-center gap-5 py-8">
          <p className="font-voice text-2xl">Now for real.</p>
          <Button
            size="icon-lg"
            aria-label="Start the run"
            className="size-16 [&_svg:not([class*='size-'])]:size-6"
            onClick={() => setStage({ name: "countdown" })}
          >
            <Play aria-hidden />
          </Button>
        </div>
      ) : null}

      {stage.name === "countdown" ? (
        <Countdown
          onDone={() =>
            setStage({
              name: "test",
              seed: randomSeed(),
              startedAt: Date.now(),
            })
          }
        />
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
        <p
          role="status"
          className="py-8 text-center text-sm text-muted-foreground"
        >
          Saving…
        </p>
      ) : null}

      {stage.name === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 py-6 text-sm"
        >
          <p>Couldn&apos;t save this run on this device.</p>
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

function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3)
  const finish = useEffectEvent(onDone)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (count === 1) finish()
      else setCount(count - 1)
    }, COUNTDOWN_STEP_MS)
    return () => clearTimeout(timer)
  }, [count])

  return (
    <p
      key={count}
      role="status"
      className="count-in flex h-72 items-center justify-center font-voice text-8xl italic"
    >
      {count}
    </p>
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
