import type { ComponentType } from "react"

export type GameMode = "practice" | "test"

export interface GameProps<Trial> {
  seed: number
  mode: GameMode
  onComplete: (trials: Trial[]) => void
}

export interface MetricDefinition {
  id: string
  label: string
  unit: "ms" | "ratio" | "count" | "index" | "ms/item"
  higherIsBetter: boolean
}

/**
 * Everything the app needs to know about a game. Protocols are fixed: nothing
 * outside a game's folder can change its parameters, and any change to them
 * must bump `protocolVersion` so old and new results are never compared.
 */
export interface AssessmentDefinition<Trial = unknown> {
  id: string
  name: string
  measures: string
  description: string
  instructions: string[]
  protocolVersion: number
  approxSeconds: number
  metrics: MetricDefinition[]
  primaryMetricId: string
  score: (trials: Trial[]) => Record<string, number>
  Game: ComponentType<GameProps<Trial>>
}
