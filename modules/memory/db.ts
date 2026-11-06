import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type {
  Analysis,
  Decision,
  Discovery,
  Hypothesis,
  Investigation,
  Measurement,
  QuestionResponse,
  Session,
} from "./schemas"

export interface TranquilityDB extends DBSchema {
  sessions: { key: string; value: Session }
  measurements: {
    key: string
    value: Measurement
    indexes: { bySession: string; byAssessment: string }
  }
  responses: {
    key: string
    value: QuestionResponse
    indexes: { bySession: string; byQuestion: string }
  }
  investigations: { key: string; value: Investigation }
  hypotheses: {
    key: string
    value: Hypothesis
    indexes: { byInvestigation: string }
  }
  analyses: { key: string; value: Analysis }
  discoveries: {
    key: string
    value: Discovery
    indexes: { byInvestigation: string }
  }
  decisions: {
    key: string
    value: Decision
    indexes: { bySession: string }
  }
  kv: { key: string; value: { key: string; value: unknown } }
}

export const DB_NAME = "tranquility"
export const DB_VERSION = 1

/** Stores in dependency-free order. `kv` holds settings and pending work. */
export const STORE_NAMES = [
  "sessions",
  "measurements",
  "responses",
  "investigations",
  "hypotheses",
  "analyses",
  "discoveries",
  "decisions",
  "kv",
] as const

export type StoreName = (typeof STORE_NAMES)[number]

let connection: Promise<IDBPDatabase<TranquilityDB>> | null = null

export function getDb() {
  connection ??= openDB<TranquilityDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("sessions", { keyPath: "id" })

      const measurements = db.createObjectStore("measurements", {
        keyPath: "id",
      })
      measurements.createIndex("bySession", "sessionId")
      measurements.createIndex("byAssessment", "assessmentId")

      const responses = db.createObjectStore("responses", { keyPath: "id" })
      responses.createIndex("bySession", "sessionId")
      responses.createIndex("byQuestion", "questionId")

      db.createObjectStore("investigations", { keyPath: "id" })

      const hypotheses = db.createObjectStore("hypotheses", { keyPath: "id" })
      hypotheses.createIndex("byInvestigation", "investigationId")

      db.createObjectStore("analyses", { keyPath: "id" })

      const discoveries = db.createObjectStore("discoveries", { keyPath: "id" })
      discoveries.createIndex("byInvestigation", "investigationId")

      const decisions = db.createObjectStore("decisions", { keyPath: "id" })
      decisions.createIndex("bySession", "sessionId")

      db.createObjectStore("kv", { keyPath: "key" })
    },
    terminated() {
      connection = null
    },
  })
  return connection
}

/** Closes the connection so it can be reopened, e.g. between tests. */
export async function closeDb() {
  if (!connection) return
  const db = await connection
  db.close()
  connection = null
}
