import { createRandom, shuffle } from "@/lib/random"

import type { GameMode } from "../types"

export const PROTOCOL = {
  version: 1,
  gridSize: 3,
  practiceTrials: 3,
  testTrials: 14,
  startLevel: 3,
  minLevel: 2,
  maxLevel: 9,
  /** The span score averages the last trials, once difficulty has settled. */
  thresholdTrials: 8,
  preparationMs: 700,
  tileOnMs: 650,
  tileOffMs: 250,
} as const

export interface SequenceTrial {
  level: number
  target: number[]
  response: number[]
  correct: boolean
}

export function trialCount(mode: GameMode): number {
  return mode === "practice" ? PROTOCOL.practiceTrials : PROTOCOL.testTrials
}

/** Each trial's sequence depends only on seed, index and level. */
export function buildSequence(seed: number, index: number, level: number) {
  const random = createRandom(seed + Math.imul(index + 1, 2246822519))
  const tiles = Array.from(
    { length: PROTOCOL.gridSize * PROTOCOL.gridSize },
    (_, tile) => tile
  )
  return shuffle(tiles, random).slice(0, level)
}

export function isCorrect(target: readonly number[], response: readonly number[]) {
  return (
    target.length === response.length &&
    target.every((tile, position) => response[position] === tile)
  )
}
