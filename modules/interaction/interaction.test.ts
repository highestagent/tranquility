import "fake-indexeddb/auto"
import { deleteDB } from "idb"
import { beforeEach, expect, it } from "vitest"
import {
  closeDb,
  kv,
  measurements,
  responses,
  analyses,
} from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"
import { setPendingTask, getPendingTask } from "@/modules/agent/pending-task"
import { commitTask, getContinuation } from "@/modules/session/checkpoint"
import { correctAnswer } from "@/modules/journal/corrections"
import {
  nextMeasurementAt,
  MIN_MEASUREMENT_INTERVAL_MS,
} from "@/modules/assessments/interval"
import { interactionSchema, validAnswer } from "./catalog"
beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})
it("rejects executable properties and model-manufactured evidence", () => {
  expect(
    interactionSchema.safeParse({
      type: "TextInput",
      props: { label: "Hello", placeholder: "", onClick: "alert(1)" },
    }).success
  ).toBe(false)
  expect(
    interactionSchema.safeParse({
      type: "EvidenceCard",
      props: { discoveryId: "a", score: 99 },
    }).success
  ).toBe(false)
  expect(
    interactionSchema.safeParse({ type: "script", props: {} }).success
  ).toBe(false)
})
it("validates quantities and selection membership before committing", () => {
  expect(
    validAnswer(
      {
        type: "NumberInput",
        props: { label: "Sleep", min: 0, max: 16, step: 0.5, unit: "hours" },
      },
      7.3
    )
  ).toBe(false)
  expect(
    validAnswer(
      { type: "MultiSelect", props: { label: "Habits", options: ["A", "B"] } },
      ["A", "A"]
    )
  ).toBe(false)
  expect(
    validAnswer(
      { type: "SingleSelect", props: { label: "Habits", options: ["A", "B"] } },
      "C"
    )
  ).toBe(false)
})
it("commits one answer and a resumable continuation atomically, ignoring duplicate submissions", async () => {
  const task = await setPendingTask({
    kind: "interaction",
    message: "How was your day?",
    reason: "Understand context",
    interaction: {
      type: "TextInput",
      props: { label: "Your day", placeholder: "" },
    },
  })
  await commitTask(task, "Continue", "Quiet")
  await commitTask(task, "Duplicate", "Busy")
  expect(await getPendingTask()).toBeNull()
  expect(await getContinuation()).toBe("Continue")
  expect(await kv.get("contextAnswers")).toEqual([
    expect.objectContaining({ id: task.id, value: "Quiet" }),
  ])
})
it("rejects an invalid answer without releasing the pending interaction", async () => {
  const task = await setPendingTask({
    kind: "interaction",
    message: "Choose",
    reason: "Context",
    interaction: { type: "BinaryChoice", props: { label: "Yes?" } },
  })
  await expect(commitTask(task, "Continue", "not boolean")).rejects.toThrow()
  expect((await getPendingTask())?.id).toBe(task.id)
  expect(await getContinuation()).toBeUndefined()
})
it("corrects context and recalculates while preserving measured outcomes and observation time", async () => {
  await responses.put({
    id: "s:sleep.hours",
    sessionId: "s",
    questionId: "sleep.hours",
    bankVersion: 1,
    value: 6,
    answeredAt: 100,
  })
  const run = await measurements.put({
    id: "run",
    sessionId: "s",
    assessmentId: "go-no-go",
    protocolVersion: 1,
    seed: 7,
    startedAt: 100,
    completedAt: 200,
    inputType: "keyboard",
    valid: true,
    trials: [],
    metrics: { medianRt: 250 },
  })
  await analyses.put({
    id: "old",
    createdAt: 200,
    factorId: "sleep.hours",
    metric: { assessmentId: "go-no-go", metricId: "medianRt" },
    method: "none",
    n: 1,
    effect: null,
    ciLow: null,
    ciHigh: null,
    pValue: null,
    direction: "none",
    grade: "insufficient",
    measurementIds: ["run"],
    notes: [],
  })
  await correctAnswer("s:sleep.hours", 8)
  expect(await responses.get("s:sleep.hours")).toMatchObject({
    value: 8,
    answeredAt: 100,
  })
  expect(await measurements.get("run")).toEqual(run)
  expect(await analyses.get("old")).toBeUndefined()
  expect((await analyses.list()).length).toBeGreaterThan(0)
  expect(await kv.get("pendingRecalculation")).toBeUndefined()
  expect(await nextMeasurementAt("go-no-go")).toBe(
    200 + MIN_MEASUREMENT_INTERVAL_MS
  )
})
