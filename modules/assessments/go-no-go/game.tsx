"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import { showOnNextFrame, useGameScript, wait } from "../runner/timing"
import type { GameProps } from "../types"
import { buildPlan, PROTOCOL, type GoNoGoTrial } from "./protocol"

type Stimulus = "go" | "no-go" | null

export function GoNoGoGame({ seed, mode, onComplete }: GameProps<GoNoGoTrial>) {
  const plan = useMemo(() => buildPlan(seed, mode), [seed, mode])
  const [stimulus, setStimulus] = useState<Stimulus>(null)
  const [feedback, setFeedback] = useState("")
  const [remaining, setRemaining] = useState(plan.length)
  const live = useRef<{ onset: number; rtMs: number | null } | null>(null)

  useGameScript(async (signal) => {
    const trials: GoNoGoTrial[] = []
    for (const [index, planned] of plan.entries()) {
      setRemaining(plan.length - index)
      await wait(planned.isiMs, signal)
      const onset = await showOnNextFrame(
        () => setStimulus(planned.isGo ? "go" : "no-go"),
        signal
      )
      live.current = { onset, rtMs: null }
      await wait(PROTOCOL.stimulusMs, signal)
      const rtMs = live.current.rtMs
      live.current = null
      setStimulus(null)
      trials.push({ ...planned, rtMs })
      if (mode === "practice") setFeedback(feedbackFor(planned.isGo, rtMs))
    }
    onComplete(trials)
  })

  function respond(timeStamp: number) {
    const trial = live.current
    if (trial && trial.rtMs === null) trial.rtMs = timeStamp - trial.onset
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return
      event.preventDefault()
      respond(event.timeStamp)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-2">
      <button
        type="button"
        aria-label="Respond"
        // Respond on press rather than click, which fires only after release.
        onPointerDown={(event) => respond(event.timeStamp)}
        onKeyDown={(event) => {
          if (event.code === "Enter") event.preventDefault()
        }}
        className="flex min-h-72 w-full flex-1 touch-none items-center justify-center rounded-3xl bg-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          data-stimulus={stimulus ?? "none"}
          aria-hidden
          className={cn(
            "size-28",
            stimulus === "go" && "rounded-full bg-primary",
            stimulus === "no-go" && "border-8 border-destructive"
          )}
        />
      </button>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{feedback}</span>
        <span className="font-mono tabular-nums">{remaining} left</span>
      </div>
    </div>
  )
}

function feedbackFor(isGo: boolean, rtMs: number | null) {
  if (isGo) return rtMs === null ? "Too slow: press for circles." : "Good."
  return rtMs === null ? "Good: you held back." : "Hold back on squares."
}
