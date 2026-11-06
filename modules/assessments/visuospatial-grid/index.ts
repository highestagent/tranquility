import { scoreStaircase } from "../runner/staircase"
import type { AssessmentDefinition } from "../types"
import { VisuospatialGridGame } from "./game"
import { PROTOCOL, type GridTrial } from "./protocol"

export const visuospatialGrid: AssessmentDefinition<GridTrial> = {
  id: "visuospatial-grid",
  name: "Visuospatial Grid",
  measures: "Visual and spatial working memory",
  description: "Remember which tiles lit up together.",
  instructions: [
    "A group of tiles lights up briefly, all at once.",
    "When they go dark, select the same tiles, in any order.",
    "Patterns grow after a correct answer and shrink after a miss.",
  ],
  protocolVersion: PROTOCOL.version,
  approxSeconds: 120,
  metrics: [
    {
      id: "span",
      label: "Pattern span",
      unit: "index",
      higherIsBetter: true,
    },
    {
      id: "maxLevel",
      label: "Largest pattern recalled",
      unit: "count",
      higherIsBetter: true,
    },
    { id: "accuracy", label: "Accuracy", unit: "ratio", higherIsBetter: true },
  ],
  primaryMetricId: "span",
  score: (trials) => scoreStaircase(trials, PROTOCOL.thresholdTrials),
  Game: VisuospatialGridGame,
}
