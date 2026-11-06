import type { z } from "zod"

import { getDb } from "./db"
import {
  analysisSchema,
  decisionSchema,
  discoverySchema,
  hypothesisSchema,
  investigationSchema,
  measurementSchema,
  responseSchema,
  sessionSchema,
  type Analysis,
  type Decision,
  type Discovery,
  type Hypothesis,
  type Investigation,
  type Measurement,
  type QuestionResponse,
  type Session,
} from "./schemas"

type RecordStore =
  | "sessions"
  | "measurements"
  | "responses"
  | "investigations"
  | "hypotheses"
  | "analyses"
  | "discoveries"
  | "decisions"

function createRepository<T>(store: RecordStore, schema: z.ZodType<T>) {
  return {
    async put(record: T): Promise<T> {
      const parsed = schema.parse(record)
      const db = await getDb()
      await db.put(store, parsed as never)
      return parsed
    },
    async get(id: string): Promise<T | undefined> {
      const db = await getDb()
      return (await db.get(store, id)) as T | undefined
    },
    async list(): Promise<T[]> {
      const db = await getDb()
      return (await db.getAll(store)) as T[]
    },
    async remove(id: string): Promise<void> {
      const db = await getDb()
      await db.delete(store, id)
    },
  }
}

export const sessions = createRepository<Session>("sessions", sessionSchema)
export const investigations = createRepository<Investigation>(
  "investigations",
  investigationSchema
)
export const analyses = createRepository<Analysis>("analyses", analysisSchema)

export const measurements = {
  ...createRepository<Measurement>("measurements", measurementSchema),
  async byAssessment(assessmentId: string): Promise<Measurement[]> {
    const db = await getDb()
    const rows = await db.getAllFromIndex(
      "measurements",
      "byAssessment",
      assessmentId
    )
    return rows.sort((a, b) => a.startedAt - b.startedAt)
  },
}

export const responses = {
  ...createRepository<QuestionResponse>("responses", responseSchema),
  async byQuestion(questionId: string): Promise<QuestionResponse[]> {
    const db = await getDb()
    const rows = await db.getAllFromIndex("responses", "byQuestion", questionId)
    return rows.sort((a, b) => a.answeredAt - b.answeredAt)
  },
  async bySession(sessionId: string): Promise<QuestionResponse[]> {
    const db = await getDb()
    return db.getAllFromIndex("responses", "bySession", sessionId)
  },
}

export const hypotheses = {
  ...createRepository<Hypothesis>("hypotheses", hypothesisSchema),
  async byInvestigation(investigationId: string): Promise<Hypothesis[]> {
    const db = await getDb()
    return db.getAllFromIndex("hypotheses", "byInvestigation", investigationId)
  },
}

export const discoveries = {
  ...createRepository<Discovery>("discoveries", discoverySchema),
  async byInvestigation(investigationId: string): Promise<Discovery[]> {
    const db = await getDb()
    return db.getAllFromIndex("discoveries", "byInvestigation", investigationId)
  },
}

export const decisions = {
  ...createRepository<Decision>("decisions", decisionSchema),
  async recent(limit = 50): Promise<Decision[]> {
    const db = await getDb()
    const rows = await db.getAll("decisions")
    return rows.sort((a, b) => b.at - a.at).slice(0, limit)
  },
}

/** Small key-value store for settings and resumable session state. */
export const kv = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = await getDb()
    return (await db.get("kv", key))?.value as T | undefined
  },
  async set(key: string, value: unknown): Promise<void> {
    const db = await getDb()
    await db.put("kv", { key, value })
  },
  async remove(key: string): Promise<void> {
    const db = await getDb()
    await db.delete("kv", key)
  },
}

export function newId() {
  return crypto.randomUUID()
}
