import { Zap } from "lucide-react"

import type { AssessmentDefinition } from "../types"
import { GoNoGoGame } from "./game"
import { GoNoGoPreview } from "./preview"
import { PROTOCOL, type GoNoGoTrial } from "./protocol"
import { scoreGoNoGo } from "./scoring"

export const goNoGo: AssessmentDefinition<GoNoGoTrial> = {
  id: "go-no-go",
  name: "Go/No-Go",
  shortName: "Reaction",
  Icon: Zap,
  measures: "Response inhibition, attention, and reaction time",
  tagline: "Tap circles. Let squares pass.",
  instructions: [
    "A filled circle means go: press Space or tap as fast as you can.",
    "An outlined square means stop: don't respond.",
    "Speed and accuracy both count.",
  ],
  protocolVersion: PROTOCOL.version,
  approxSeconds: 120,
  metrics: [
    {
      id: "medianRt",
      label: "Median reaction time",
      unit: "ms",
      higherIsBetter: false,
    },
    {
      id: "rtVariability",
      label: "Reaction time variability",
      unit: "ms",
      higherIsBetter: false,
    },
    {
      id: "commissionRate",
      label: "False starts on squares",
      unit: "ratio",
      higherIsBetter: false,
    },
    {
      id: "omissionRate",
      label: "Missed circles",
      unit: "ratio",
      higherIsBetter: false,
    },
    {
      id: "dPrime",
      label: "Discrimination (d′)",
      unit: "index",
      higherIsBetter: true,
    },
  ],
  primaryMetricId: "medianRt",
  score: scoreGoNoGo,
  Game: GoNoGoGame,
  Preview: GoNoGoPreview,
}
