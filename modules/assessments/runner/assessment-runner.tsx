"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, Clock, Play, X } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { randomSeed } from "@/lib/random"
import {
  getCurrentSession,
  measurements,
  newId,
  type Measurement,
} from "@/modules/memory"

import { assessmentHistory, MIN_MEASUREMENT_INTERVAL_MS } from "../interval"
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
  runId?: string
  /** Why this game, shown only before it starts. */
  eyebrow?: React.ReactNode
  /** Called with the saved run, or `null` if the user stopped before the end. */
  onFinish?: (measurement: Measurement | null) => void
  doneLabel?: string
}

type InputType = Measurement["inputType"]

export function AssessmentRunner({
  assessmentId,
  runId,
  eyebrow,
  onFinish,
  doneLabel = "Done",
}: AssessmentRunnerProps) {
  const assessment = getAssessment(assessmentId)
  if (!assessment) throw new Error(`Unknown assessment: ${assessmentId}`)

  const [stage, setStage] = useState<Stage>({ name: "intro" })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (stage.name !== "intro") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stage.name])
  const protocolVersion = assessment.protocolVersion
  const [hasPlayed, setHasPlayed] = useState(false)
  const [availableAt, setAvailableAt] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    Promise.all([
      assessmentHistory(assessmentId),
      runId ? measurements.get(runId) : Promise.resolve(undefined),
    ]).then(
      ([history, saved]) => {
        if (!active) return
        setAvailableAt(history.availableAt)
        setHasPlayed(
          history.completed.some(
            (run) => run.protocolVersion === protocolVersion
          )
        )
        if (saved) setStage({ name: "result", measurement: saved })
      },
      () => {
        if (active) setStage({ name: "error" })
      }
    )
    return () => {
      active = false
    }
  }, [assessmentId, protocolVersion, runId])
  const retrySave = useRef<(() => Promise<void>) | null>(null)
  const saveId = useRef<{ startedAt: number; id: string } | null>(null)
  const saving = useRef(false)
  const inputTypeRef = useRef<InputType>("unknown")

  async function save(
    test: Extract<Stage, { name: "test" }>,
    trials: unknown[],
    invalidReason?: string
  ) {
    if (saving.current) return
    saving.current = true
    retrySave.current = () => save(test, trials, invalidReason)
    if (saveId.current?.startedAt !== test.startedAt)
      saveId.current = { startedAt: test.startedAt, id: runId ?? newId() }
    setStage({ name: "saving" })
    try {
      const session = await getCurrentSession()
      const measurement = await measurements.put({
        id: saveId.current.id,
        sessionId: session.id,
        assessmentId: assessment!.id,
        protocolVersion: assessment!.protocolVersion,
        seed: test.seed,
        startedAt: test.startedAt,
        // Captured in the game-completion callback, never during rendering.
        // eslint-disable-next-line react-hooks/purity
        completedAt: Date.now(),
        inputType: inputTypeRef.current,
        valid: !invalidReason,
        invalidReason,
        trials,
        metrics: invalidReason ? {} : assessment!.score(trials as never[]),
      })
      retrySave.current = null
      if (measurement.valid) {
        setHasPlayed(true)
        setAvailableAt(measurement.completedAt + MIN_MEASUREMENT_INTERVAL_MS)
      }
      setStage({ name: "result", measurement })
    } catch {
      setStage({ name: "error" })
    } finally {
      saving.current = false
    }
  }

  useEffect(() => {
    const immersive = [
      "practice",
      "ready",
      "countdown",
      "test",
      "saving",
    ].includes(stage.name)
    document.body.toggleAttribute("data-assessment-active", immersive)
    return () => document.body.removeAttribute("data-assessment-active")
  }, [stage.name])

  const test = stage.name === "test" ? stage : null
  useRunGuards(test !== null, inputTypeRef, () => {
    if (test) void save(test, [], "The tab lost focus during the run.")
  })

  const { Game, Preview, Icon } = assessment

  function stop() {
    setStage({ name: "intro" })
    onFinish?.(null)
  }

  switch (stage.name) {
    case "intro":
      return (
        <Screen
          eyebrow={eyebrow ?? <p className="eyebrow">{assessment.shortName}</p>}
          title={assessment.tagline}
          dock={
            <>
              <Button
                size="cta"
                disabled={availableAt === null || availableAt > now}
                onClick={() =>
                  setStage(
                    hasPlayed ? { name: "countdown" } : { name: "practice" }
                  )
                }
              >
                <Play aria-hidden data-icon="inline-start" />
                {availableAt && availableAt > now
                  ? `Available after ${new Date(availableAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : hasPlayed
                    ? "Start game"
                    : "Try it"}
              </Button>
              {onFinish ? (
                <Button
                  size="cta"
                  variant="ghost"
                  onClick={() => onFinish(null)}
                >
                  Not now
                </Button>
              ) : null}
            </>
          }
        >
          <div className="rise-in my-auto flex h-52 items-center justify-center">
            <Preview />
          </div>
          <Collapsible className="group text-sm text-muted-foreground">
            <CollapsibleTrigger className="group flex w-full cursor-pointer list-none items-center justify-between gap-3 text-left text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-1.5">
                <Clock aria-hidden className="size-3.5" />
                {Math.ceil(assessment.approxSeconds / 60)} min · stay on this
                tab
              </span>
              <span className="flex items-center gap-1">
                Rules
                <ChevronDown
                  aria-hidden
                  className="size-3.5 transition-transform duration-200 group-aria-expanded:rotate-180"
                />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {assessment.instructions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </Screen>
      )

    case "practice":
    case "countdown":
    case "test":
      // Nothing but the game and a way out, so nothing competes with what's
      // being measured.
      return (
        <section
          data-assessment-immersive="true"
          aria-label={assessment.name}
          className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-6"
        >
          <div className="flex items-center justify-between gap-3 pb-3">
            <p className="flex items-center gap-2 eyebrow">
              <Icon aria-hidden className="size-3.5" />
              {stage.name === "practice" ? "Practice" : assessment.shortName}
            </p>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Stop"
              title="Stop"
              className="-mr-2"
              onClick={stop}
            >
              <X aria-hidden />
            </Button>
          </div>
          {stage.name === "practice" ? (
            <Game
              seed={PRACTICE_SEED}
              mode="practice"
              onComplete={() => setStage({ name: "ready" })}
            />
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
        </section>
      )

    case "ready":
      return (
        <Screen
          eyebrow={<p className="eyebrow">Practice done</p>}
          title="Now for real."
          dock={
            <Button size="cta" onClick={() => setStage({ name: "countdown" })}>
              <Play aria-hidden data-icon="inline-start" />
              Start
            </Button>
          }
        >
          <div className="my-auto flex h-52 items-center justify-center opacity-60">
            <Preview />
          </div>
        </Screen>
      )

    case "saving":
      return (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          Saving…
        </p>
      )

    case "error":
      return (
        <div role="alert" className="flex flex-1 flex-col">
          <Screen
            title="I couldn't save this run."
            dock={
              <Button
                size="cta"
                onClick={() => {
                  if (retrySave.current) void retrySave.current()
                  else window.location.reload()
                }}
              >
                Try again
              </Button>
            }
          />
        </div>
      )

    case "result":
      return (
        <RunResult
          assessment={assessment}
          measurement={stage.measurement}
          doneLabel={doneLabel}
          onRetry={() => {
            if (runId && onFinish) onFinish(stage.measurement)
            else setStage({ name: "intro" })
          }}
          onDone={() => {
            if (onFinish) onFinish(stage.measurement)
            else setStage({ name: "intro" })
          }}
        />
      )
  }
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
      className="count-in m-auto font-voice text-[7rem] font-light"
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
