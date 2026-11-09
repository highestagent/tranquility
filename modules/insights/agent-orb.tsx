"use client"

import { useSyncExternalStore } from "react"
import { ThinkingOrb } from "thinking-orbs"

export type OrbState = "resting" | "thinking" | "asleep" | "error"

const motionQuery = "(prefers-reduced-motion: reduce)"

function subscribeToMotion(onChange: () => void) {
  const media = window.matchMedia(motionQuery)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function prefersReducedMotion() {
  return window.matchMedia(motionQuery).matches
}

export function AgentOrb({
  state,
  size = 64,
  color,
  animated = state === "thinking",
}: {
  state: OrbState
  size?: 20 | 64
  color?: string
  animated?: boolean
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    prefersReducedMotion,
    () => true
  )

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <ThinkingOrb
        state={state === "thinking" ? "working" : "breathing"}
        size={size}
        color={color}
        paused={reducedMotion || !animated}
      />
    </span>
  )
}
