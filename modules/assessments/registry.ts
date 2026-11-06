import { goNoGo } from "./go-no-go"
import { sequenceRecall } from "./sequence-recall"
import type { AssessmentDefinition } from "./types"
import { visuospatialGrid } from "./visuospatial-grid"

/** Add a game by exporting a definition from its folder and listing it here. */
const definitions = [goNoGo, visuospatialGrid, sequenceRecall] as unknown as AssessmentDefinition<never>[]

export const ASSESSMENTS: readonly AssessmentDefinition<never>[] = definitions

export function getAssessment(id: string) {
  return ASSESSMENTS.find((assessment) => assessment.id === id)
}
