"use client"

import { useState } from "react"

import { nextLevel } from "../runner/staircase"
import { TileGrid } from "../runner/tile-grid"
import { useGameScript, wait } from "../runner/timing"
import { useTileCollector } from "../runner/use-tile-collector"
import type { GameProps } from "../types"
import {
  buildSequence,
  isCorrect,
  PROTOCOL,
  trialCount,
  type SequenceTrial,
} from "./protocol"

export function SequenceRecallGame({
  seed,
  mode,
  onComplete,
}: GameProps<SequenceTrial>) {
  const [lit, setLit] = useState<number[]>([])
  const [status, setStatus] = useState("Get ready")
  const [remaining, setRemaining] = useState(trialCount(mode))
  const tiles = useTileCollector({ allowUndo: false })

  useGameScript(async (signal) => {
    const trials: SequenceTrial[] = []
    let level: number = PROTOCOL.startLevel
    const total = trialCount(mode)

    for (let index = 0; index < total; index++) {
      setRemaining(total - index)
      tiles.clear()
      setStatus("Watch the order")
      await wait(PROTOCOL.preparationMs, signal)

      const target = buildSequence(seed, index, level)
      for (const tile of target) {
        setLit([tile])
        await wait(PROTOCOL.tileOnMs, signal)
        setLit([])
        await wait(PROTOCOL.tileOffMs, signal)
      }

      setStatus(`Press ${level} tiles in order`)
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
