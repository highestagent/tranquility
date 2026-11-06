import { ScanSearch } from "lucide-react"

import type { AssessmentDefinition } from "../types"
import { VisualSearchGame } from "./game"
import { VisualSearchPreview } from "./preview"
import { PROTOCOL, type SearchTrial } from "./protocol"
import { scoreVisualSearch } from "./scoring"

export const visualSearch: AssessmentDefinition<SearchTrial> = {
  id: "visual-search",
  name: "Visual Search",
  shortName: "Search",
  Icon: ScanSearch,
  measures: "Selective attention and visual processing speed",
  tagline: "Find the T among the Ls.",
  instructions: [
    "A board of rotated letters appears. Look for a T among the Ls.",
    "Press J or tap “T found” if there is one.",
    "Press F or tap “No T” if there isn't.",
    "Answer as quickly and accurately as you can.",
  ],
  protocolVersion: PROTOCOL.version,
  approxSeconds: 130,
  metrics: [
    {
      id: "medianRt",
      label: "Median time to find",
      unit: "ms",
      higherIsBetter: false,
    },
    {
      id: "searchSlope",
      label: "Search cost per item",
      unit: "ms/item",
      higherIsBetter: false,
    },
    { id: "accuracy", label: "Accuracy", unit: "ratio", higherIsBetter: true },
  ],
  primaryMetricId: "medianRt",
  score: scoreVisualSearch,
  Game: VisualSearchGame,
  Preview: VisualSearchPreview,
}
