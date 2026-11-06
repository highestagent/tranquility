import { createRandom, shuffle } from "@/lib/random"

import type { GameMode } from "../types"

export const PROTOCOL = {
  version: 1,
  gridSize: 5,
  practiceTrials: 3,
  testTrials: 14,
  startLevel: 3,
  minLevel: 2,
  maxLevel: 14,
  /** The span score averages the last trials, once difficulty has settled. */
  thresholdTrials: 8,
  preparationMs: 600,
  displayMs: 1000,
  retentionMs: 500,
} as const

export interface GridTrial {
  level: number
  target: number[]
  response: number[]
  correct: boolean
}

export function trialCount(mode: GameMode): number {
  return mode === "practice" ? PROTOCOL.practiceTrials : PROTOCOL.testTrials
}

/** Each trial's pattern depends only on seed, index and level. */
export function buildPattern(seed: number, index: number, level: number) {
  const random = createRandom(seed + Math.imul(index + 1, 2654435761))
  const tiles = Array.from(
    { length: PROTOCOL.gridSize * PROTOCOL.gridSize },
    (_, tile) => tile
  )
  return shuffle(tiles, random).slice(0, level)
}

export function isCorrect(target: readonly number[], response: readonly number[]) {
  return (
    target.length === response.length &&
    target.every((tile) => response.includes(tile))
  )
}
