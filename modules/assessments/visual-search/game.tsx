"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

import { showOnNextFrame, useGameScript, wait } from "../runner/timing"
import type { GameProps } from "../types"
import {
  buildPlan,
  PROTOCOL,
  type PlannedSearch,
  type SearchTrial,
} from "./protocol"

interface Answer {
  response: boolean
  timeStamp: number
}

export function VisualSearchGame({
  seed,
  mode,
  onComplete,
}: GameProps<SearchTrial>) {
  const plan = useMemo(() => buildPlan(seed, mode), [seed, mode])
  const [current, setCurrent] = useState<PlannedSearch | null>(null)
  const [feedback, setFeedback] = useState("")
  const [remaining, setRemaining] = useState(plan.length)
  const answer = useRef<((value: Answer) => void) | null>(null)

  function respond(response: boolean, timeStamp: number) {
    answer.current?.({ response, timeStamp })
  }

  useGameScript(async (signal) => {
    const trials: SearchTrial[] = []
    for (const [index, planned] of plan.entries()) {
      setRemaining(plan.length - index)
      await wait(PROTOCOL.itiMs, signal)

      const answered = new Promise<Answer>((resolve) => {
        answer.current = resolve
      })
      const onset = await showOnNextFrame(() => setCurrent(planned), signal)
      const result = await Promise.race([
        answered,
        wait(PROTOCOL.timeoutMs, signal).then(() => null),
      ])
      answer.current = null
      setCurrent(null)

      trials.push({
        setSize: planned.setSize,
        present: planned.present,
        response: result?.response ?? null,
        rtMs: result ? result.timeStamp - onset : null,
      })
      if (mode === "practice") {
        setFeedback(
          result === null
            ? "Too slow."
            : result.response === planned.present
              ? "Correct."
              : planned.present
                ? "There was a T."
                : "There was no T."
        )
      }
    }
    onComplete(trials)
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return
      if (event.code === "KeyJ") respond(true, event.timeStamp)
      if (event.code === "KeyF") respond(false, event.timeStamp)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div
        data-testid="search-board"
        aria-hidden
        className="relative mx-auto aspect-square w-full rounded-3xl bg-muted select-none"
      >
        {current?.items.map((item) => (
          <span
            key={`${item.x}-${item.y}`}
            className="absolute font-mono text-2xl leading-none font-medium"
            data-target={item.isTarget || undefined}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
            }}
          >
            {item.isTarget ? "T" : "L"}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          variant="outline"
          className="h-14 touch-manipulation"
          onPointerDown={(event) => respond(false, event.timeStamp)}
        >
          No T (F)
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 touch-manipulation"
          onPointerDown={(event) => respond(true, event.timeStamp)}
        >
          T found (J)
        </Button>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{feedback}</span>
        <span className="font-mono tabular-nums">{remaining} left</span>
      </div>
    </div>
  )
}
