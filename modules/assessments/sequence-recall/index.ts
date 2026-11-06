import { Route } from "lucide-react"

import { scoreStaircase } from "../runner/staircase"
import type { AssessmentDefinition } from "../types"
import { SequenceRecallGame } from "./game"
import { SequenceRecallPreview } from "./preview"
import { PROTOCOL, type SequenceTrial } from "./protocol"

export const sequenceRecall: AssessmentDefinition<SequenceTrial> = {
  id: "sequence-recall",
  name: "Sequence Recall",
  shortName: "Sequence",
  Icon: Route,
  measures: "Sequential working memory",
  tagline: "Watch the order. Repeat it.",
  instructions: [
    "Tiles light up one at a time.",
    "When they stop, press the same tiles in the same order.",
    "Sequences grow after a correct answer and shrink after a miss.",
  ],
  protocolVersion: PROTOCOL.version,
  approxSeconds: 170,
  metrics: [
    {
      id: "span",
      label: "Sequence span",
      unit: "index",
      higherIsBetter: true,
    },
    {
      id: "maxLevel",
      label: "Longest sequence recalled",
      unit: "count",
      higherIsBetter: true,
    },
    { id: "accuracy", label: "Accuracy", unit: "ratio", higherIsBetter: true },
  ],
  primaryMetricId: "span",
  score: (trials) => scoreStaircase(trials, PROTOCOL.thresholdTrials),
  Game: SequenceRecallGame,
  Preview: SequenceRecallPreview,
}
