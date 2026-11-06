import { createRandom, randomInt, shuffle } from "@/lib/random"

import type { GameMode } from "../types"

export const PROTOCOL = {
  version: 1,
  practiceTrials: 8,
  testTrials: 60,
  noGoFraction: 0.25,
  stimulusMs: 500,
  isiMinMs: 800,
  isiMaxMs: 1400,
  /** Faster responses are anticipations, not reactions to the stimulus. */
  minValidRtMs: 100,
} as const

export interface PlannedTrial {
  isGo: boolean
  isiMs: number
}

export interface GoNoGoTrial extends PlannedTrial {
  /** `null` means no response. */
  rtMs: number | null
}

export function buildPlan(seed: number, mode: GameMode): PlannedTrial[] {
  const random = createRandom(seed)
  const total =
    mode === "practice" ? PROTOCOL.practiceTrials : PROTOCOL.testTrials
  const noGo = Math.round(total * PROTOCOL.noGoFraction)
  const kinds = shuffle(
    Array.from({ length: total }, (_, index) => index >= noGo),
    random
  )
  return kinds.map((isGo) => ({
    isGo,
    isiMs: randomInt(PROTOCOL.isiMinMs, PROTOCOL.isiMaxMs, random),
  }))
}
