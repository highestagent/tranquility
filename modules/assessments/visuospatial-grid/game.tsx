"use client"

import { useState } from "react"

import { nextLevel } from "../runner/staircase"
import { TileGrid } from "../runner/tile-grid"
import { useGameScript, wait } from "../runner/timing"
import { useTileCollector } from "../runner/use-tile-collector"
import type { GameProps } from "../types"
import {
  buildPattern,
  isCorrect,
  PROTOCOL,
  trialCount,
  type GridTrial,
} from "./protocol"

export function VisuospatialGridGame({
  seed,
  mode,
  onComplete,
}: GameProps<GridTrial>) {
  const [lit, setLit] = useState<number[]>([])
  const [status, setStatus] = useState("Get ready")
  const [remaining, setRemaining] = useState(trialCount(mode))
  const tiles = useTileCollector({ allowUndo: true })

  useGameScript(async (signal) => {
    const trials: GridTrial[] = []
    let level: number = PROTOCOL.startLevel
    const total = trialCount(mode)

    for (let index = 0; index < total; index++) {
      setRemaining(total - index)
      tiles.clear()
      setStatus("Watch the pattern")
      await wait(PROTOCOL.preparationMs, signal)

      const target = buildPattern(seed, index, level)
      setLit(target)
      await wait(PROTOCOL.displayMs, signal)
      setLit([])
      await wait(PROTOCOL.retentionMs, signal)

      setStatus(`Select ${level} tiles`)
      const response = await tiles.collect(level, signal)
      const correct = isCorrect(target, response)
      trials.push({ level, target, response, correct })
      if (mode === "practice") {
        setStatus(correct ? "Correct" : "Not quite")
        await wait(800, signal)
      }
      level = nextLevel(level, correct, {
        min: PROTOCOL.minLevel,
        max: PROTOCOL.maxLevel,
      })
    }
    onComplete(trials)
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-sm">
        <span aria-live="polite">{status}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {remaining} left
        </span>
      </div>
      <TileGrid
        size={PROTOCOL.gridSize}
        lit={lit}
        selected={tiles.selected}
        interactive={tiles.collecting}
        onPress={tiles.press}
      />
    </div>
  )
}
