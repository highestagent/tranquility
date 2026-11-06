import { z } from "zod"

const id = z.string().min(1)
const timestamp = z.number().int().nonnegative()

export const sessionSchema = z.object({
  id,
  startedAt: timestamp,
  endedAt: timestamp.optional(),
})

export const measurementSchema = z.object({
  id,
  sessionId: id,
  assessmentId: id,
  protocolVersion: z.number().int().positive(),
  seed: z.number().int(),
  startedAt: timestamp,
  completedAt: timestamp,
  inputType: z.enum(["keyboard", "pointer", "touch", "unknown"]),
  valid: z.boolean(),
  invalidReason: z.string().optional(),
  trials: z.array(z.unknown()),
  metrics: z.record(z.string(), z.number()),
})

export const responseSchema = z.object({
  id,
  sessionId: id,
  questionId: id,
  bankVersion: z.number().int().positive(),
  /** `null` records that the user declined the question. */
  value: z.number().nullable(),
  answeredAt: timestamp,
})

export const hypothesisStatusSchema = z.enum([
  "proposed",
  "testing",
  "supported",
  "refuted",
  "inconclusive",
  "rejected",
])

export const metricRefSchema = z.object({
  assessmentId: id,
  metricId: id,
})

export const hypothesisSchema = z.object({
  id,
  investigationId: id,
  statement: z.string().min(1),
  factorId: id,
  metric: metricRefSchema,
  expectedDirection: z.enum(["positive", "negative", "any"]),
  status: hypothesisStatusSchema,
  rationale: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
  history: z.array(
    z.object({
      at: timestamp,
      status: hypothesisStatusSchema,
      note: z.string(),
    })
  ),
})

export const evidenceRequirementSchema = z.object({
  factorId: id,
  metric: metricRefSchema,
  minPairs: z.number().int().positive(),
})

export const investigationSchema = z.object({
  id,
  title: z.string().min(1),
  question: z.string().min(1),
  origin: z.enum(["agent", "user"]),
  status: z.enum(["active", "paused", "completed"]),
  objectives: z.array(z.string()),
  evidenceRequirements: z.array(evidenceRequirementSchema),
  progressNote: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const evidenceGradeSchema = z.enum([
  "insufficient",
  "weak",
  "moderate",
  "strong",
  "contradictory",
])

export const analysisSchema = z.object({
  id,
  createdAt: timestamp,
  factorId: id,
  metric: metricRefSchema,
  method: z.enum(["spearman", "permutation", "none"]),
  n: z.number().int().nonnegative(),
  effect: z.number().nullable(),
  ciLow: z.number().nullable(),
  ciHigh: z.number().nullable(),
  pValue: z.number().nullable(),
  /** Higher-is-better adjusted effect direction, when an effect exists. */
  direction: z.enum(["positive", "negative", "none"]),
  grade: evidenceGradeSchema,
  measurementIds: z.array(id),
  notes: z.array(z.string()),
})

export const discoverySchema = z.object({
  id,
  investigationId: id,
  hypothesisId: id,
  analysisIds: z.array(id).min(1),
  grade: evidenceGradeSchema,
  verdict: z.enum(["supported", "refuted", "inconclusive"]),
  observed: z.string().min(1),
  evidence: z.string().min(1),
  reliability: z.string().min(1),
  uncertainty: z.string().min(1),
  nextStep: z.string().min(1),
  createdAt: timestamp,
})

export const decisionSchema = z.object({
  id,
  sessionId: id,
  action: z.string().min(1),
  reason: z.string(),
  at: timestamp,
  investigationId: id.optional(),
})

export const kvSchema = z.object({
  key: id,
  value: z.unknown(),
})

export type Session = z.infer<typeof sessionSchema>
export type Measurement = z.infer<typeof measurementSchema>
export type QuestionResponse = z.infer<typeof responseSchema>
export type Hypothesis = z.infer<typeof hypothesisSchema>
export type HypothesisStatus = z.infer<typeof hypothesisStatusSchema>
export type MetricRef = z.infer<typeof metricRefSchema>
export type EvidenceRequirement = z.infer<typeof evidenceRequirementSchema>
export type Investigation = z.infer<typeof investigationSchema>
export type EvidenceGrade = z.infer<typeof evidenceGradeSchema>
export type Analysis = z.infer<typeof analysisSchema>
export type Discovery = z.infer<typeof discoverySchema>
export type Decision = z.infer<typeof decisionSchema>
