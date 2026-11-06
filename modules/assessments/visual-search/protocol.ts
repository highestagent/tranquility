import { createRandom, randomInt, shuffle } from "@/lib/random"

import type { GameMode } from "../types"

export const PROTOCOL = {
  version: 1,
  setSizes: [8, 16, 24],
  /** Trials per combination of set size and target presence. */
  trialsPerCell: 8,
  practiceTrials: 6,
  gridCells: 7,
  itiMs: 700,
  timeoutMs: 6000,
} as const

export interface SearchItem {
  /** Position as a percentage of the board. */
  x: number
  y: number
  rotation: 0 | 90 | 180 | 270
  isTarget: boolean
}

export interface PlannedSearch {
  setSize: number
  present: boolean
  items: SearchItem[]
}

export interface SearchTrial {
  setSize: number
  present: boolean
  /** `null` means no answer before the timeout. */
  response: boolean | null
  rtMs: number | null
}

const ROTATIONS = [0, 90, 180, 270] as const

function buildItems(
  setSize: number,
  present: boolean,
  random: () => number
): SearchItem[] {
  const { gridCells } = PROTOCOL
  const cell = 100 / gridCells
  const cells = shuffle(
    Array.from({ length: gridCells * gridCells }, (_, index) => index),
    random
  ).slice(0, setSize)

  return cells.map((position, index) => ({
    x: (position % gridCells) * cell + cell * (0.3 + random() * 0.4),
    y: Math.floor(position / gridCells) * cell + cell * (0.3 + random() * 0.4),
    rotation: ROTATIONS[randomInt(0, 3, random)]!,
    isTarget: present && index === 0,
  }))
}

export function buildPlan(seed: number, mode: GameMode): PlannedSearch[] {
  const random = createRandom(seed)
  const conditions = PROTOCOL.setSizes.flatMap((setSize) =>
    [true, false].flatMap((present) =>
      Array.from({ length: PROTOCOL.trialsPerCell }, () => ({
        setSize,
        present,
      }))
    )
  )
  const chosen =
    mode === "practice"
      ? Array.from({ length: PROTOCOL.practiceTrials }, (_, index) => ({
          setSize: PROTOCOL.setSizes[index % PROTOCOL.setSizes.length]!,
          present: index % 2 === 0,
        }))
      : conditions
  return shuffle(chosen, random).map(({ setSize, present }) => ({
    setSize,
    present,
    items: buildItems(setSize, present, random),
  }))
}
