import "fake-indexeddb/auto"

import { deleteDB } from "idb"
import { simulateReadableStream, type ModelMessage } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { beforeEach, describe, expect, it } from "vitest"

import { createRandom } from "@/lib/random"
import {
  analyses,
  closeDb,
  decisions,
  discoveries,
  hypotheses,
  investigations,
  measurements,
  responses,
  sessions,
  type EvidenceGrade,
} from "@/modules/memory"
import { DB_NAME } from "@/modules/memory/db"

import { createInvestigationAgent } from "./agent"
import { clearPendingTask, getPendingTask } from "./pending-task"
import { activeToolsFor, stageFor } from "./policy"
import { investigationTools } from "./tools"
import { describeEffect, roundNumbers } from "./tools/shared"

const USAGE = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
}

type ToolCall = { tool: string; input: unknown }

/** A model that plays a fixed script, recording what it was allowed to do. */
function scriptedModel(
  script: (previousResults: Map<string, unknown>) => (ToolCall | string)[]
) {
  const offered: string[][] = []
  const prompts: unknown[] = []
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const step = offered.length
      offered.push((options.tools ?? []).map((tool) => tool.name))
      prompts.push(options.prompt)

      const results = new Map<string, unknown>()
      for (const message of options.prompt) {
        if (message.role !== "tool") continue
        for (const part of message.content) {
          if (part.type === "tool-result" && part.output.type === "json") {
            results.set(part.toolName, part.output.value)
          }
        }
      }

      const entry = script(results)[step]
      if (typeof entry === "string" || entry === undefined) {
        return {
          content: [{ type: "text", text: entry ?? "Done." }],
          finishReason: { unified: "stop", raw: undefined },
          usage: USAGE,
          warnings: [],
        }
      }
      return {
        content: [
          {
            type: "tool-call",
            toolCallId: `call-${step}`,
            toolName: entry.tool,
            input: JSON.stringify(entry.input),
          },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: USAGE,
        warnings: [],
      }
    },
  })
  return { model, offered, prompts }
}

/** The tool results a model request carried, by their call IDs. */
function toolResultIds(prompt: unknown) {
  return (prompt as { role: string; content: { toolCallId?: string }[] }[])
    .filter(({ role }) => role === "tool")
    .flatMap(({ content }) => content.map(({ toolCallId }) => toolCallId))
}

/** A session so far: each turn read state through a tool, then answered. */
function earlierTurns(count: number): ModelMessage[] {
  return Array.from({ length: count }, (_, index): ModelMessage[] => [
    { role: "user", content: `Earlier question ${index}` },
    {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: `old-${index}`,
          toolName: "getUserContext",
          input: { reason: "Review" },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: `old-${index}`,
          toolName: "getUserContext",
          output: {
            type: "json",
            value: { sessions: 24, filler: "x".repeat(500) },
          },
        },
      ],
    },
    {
      role: "assistant",
      content: [{ type: "text", text: `Earlier answer ${index}` }],
    },
  ]).flat()
}

async function seedPlantedRelationship(count = 24) {
  const random = createRandom(7)
  for (let index = 0; index < count; index++) {
    const id = `s${index}`
    const hours = 4 + random() * 5
    await sessions.put({ id, startedAt: 1000 + index })
    await measurements.put({
      id: `m${index}`,
      sessionId: id,
      assessmentId: "go-no-go",
      protocolVersion: 1,
      seed: index,
      startedAt: 1000 + index,
      completedAt: 2000 + index,
      inputType: "keyboard",
      valid: true,
      trials: [],
      metrics: { medianRt: 450 - 20 * hours + (random() - 0.5) * 30 },
    })
    await responses.put({
      id: `r${index}`,
      sessionId: id,
      questionId: "sleep.hours",
      bankVersion: 1,
      value: hours,
      answeredAt: 1000 + index,
    })
  }
}

beforeEach(async () => {
  await closeDb()
  await deleteDB(DB_NAME)
})

describe("policy", () => {
  it("requires reading before acting", () => {
    expect(stageFor([])).toBe("understand")
    expect(activeToolsFor("understand")).toEqual([
      "getUserContext",
      "getMeasurements",
    ])
  })

  it("unlocks evaluateEvidence only after analysis", () => {
    expect(activeToolsFor(stageFor(["getUserContext"]))).not.toContain(
      "evaluateEvidence"
    )
    expect(
      activeToolsFor(stageFor(["getUserContext", "analyzePerformance"]))
    ).toContain("evaluateEvidence")
  })
})

describe("describeEffect", () => {
  const describe_ = (
    direction: "positive" | "negative" | "none",
    grade: EvidenceGrade
  ) => describeEffect("go-no-go", "medianRt", { direction, grade })

  it("reads polarity from the metric", () => {
    expect(describe_("negative", "strong")).toMatch(/lower, which is better/)
    expect(describe_("positive", "moderate")).toMatch(/higher, which is worse/)
  })

  it("never presents a faint or empty result as a finding", () => {
    expect(describe_("none", "insufficient")).toMatch(/not enough data/i)
    expect(describe_("negative", "weak")).toMatch(/could easily be chance/)
    expect(describe_("negative", "contradictory")).toMatch(/reversed/)
  })
})

describe("tool inputs", () => {
  const schema = (tool: { inputSchema: unknown }) =>
    tool.inputSchema as {
      safeParse: (value: unknown) => { success: boolean; data?: object }
    }

  it("rejects unknown assessments and questions", () => {
    expect(
      schema(investigationTools.selectAssessment).safeParse({
        reason: "x",
        assessmentId: "made-up-game",
      }).success
    ).toBe(false)
    expect(
      schema(investigationTools.selectQuestions).safeParse({
        reason: "x",
        questionIds: ["made.up"],
      }).success
    ).toBe(false)
  })

  it("discards protocol changes and supplied numbers", () => {
    const assessment = schema(investigationTools.selectAssessment).safeParse({
      reason: "x",
      assessmentId: "go-no-go",
      protocol: { testTrials: 2 },
    })
    expect(assessment.data).not.toHaveProperty("protocol")

    const analysis = schema(investigationTools.analyzePerformance).safeParse({
      reason: "x",
      mode: "relationship",
      effect: 0.99,
      values: [1, 2, 3],
    })
    expect(analysis.data).not.toHaveProperty("effect")
    expect(analysis.data).not.toHaveProperty("values")
  })

  it("rejects numerals in agent-written findings", () => {
    const parse = (observed: string) =>
      schema(investigationTools.evaluateEvidence).safeParse({
        reason: "x",
        hypothesisId: "h",
        analysisIds: ["a"],
        observed,
        uncertainty: "Unknown.",
        nextStep: "Continue.",
      }).success
    expect(parse("You react faster after more sleep.")).toBe(true)
    expect(parse("You react 50ms faster after more sleep.")).toBe(false)
  })

  it("has no tool that can write measurements or answers", () => {
    expect(Object.keys(investigationTools).sort()).toEqual(
      [
        "analyzePerformance",
        "evaluateEvidence",
        "getMeasurements",
        "getUserContext",
        "manageHypotheses",
        "planInvestigation",
        "presentInteraction",
        "restSession",
        "saveInvestigation",
        "selectAssessment",
        "selectQuestions",
      ].sort()
    )
  })
})

describe("getUserContext", () => {
  it("shows which questions have data, as counts without values", async () => {
    await seedPlantedRelationship(3)
    await responses.put({
      id: "declined",
      sessionId: "s0",
      questionId: "stress.level",
      bankVersion: 1,
      value: null,
      answeredAt: 1,
    })
    const { model } = scriptedModel(() => [
      { tool: "getUserContext", input: { reason: "Review" } },
      "Done.",
    ])

    const result = await createInvestigationAgent(model).generate({
      prompt: "Go.",
    })

    const output = result.steps[0]?.toolResults[0]?.output as {
      coverage: unknown
      answers: unknown
    }
    expect(output.coverage).toEqual([
      { questionId: "sleep.hours", answered: 3, declined: 0 },
      { questionId: "stress.level", answered: 0, declined: 1 },
    ])
    // Values are still only sent for questions asked about by name.
    expect(output.answers).toEqual([])
  })
})

describe("roundNumbers", () => {
  it("rounds to four significant figures", () => {
    expect(roundNumbers(335.59999999403954)).toBe(335.6)
    expect(roundNumbers(-0.8907446750934906)).toBe(-0.8907)
    expect(roundNumbers(1206.4)).toBe(1206)
    expect(roundNumbers(0.000123456)).toBe(0.0001235)
  })

  it("leaves whole numbers exactly as they are", () => {
    expect(roundNumbers(24)).toBe(24)
    expect(roundNumbers(1793937731471)).toBe(1793937731471)
    expect(roundNumbers(0)).toBe(0)
  })

  it("rounds at any depth, and touches nothing else", () => {
    const input = {
      analysisId: "a1",
      grade: "strong",
      ok: true,
      none: null,
      nested: { values: [1.23456, { deep: 9.87654 }] },
    }
    expect(roundNumbers(input)).toEqual({
      analysisId: "a1",
      grade: "strong",
      ok: true,
      none: null,
      nested: { values: [1.235, { deep: 9.877 }] },
    })
    // The original isn't changed.
    expect(input.nested.values[0]).toBe(1.23456)
  })

  it("doesn't break on values that can't be rounded", () => {
    expect(roundNumbers(Number.NaN)).toBeNaN()
    expect(roundNumbers(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY
    )
  })
})

describe("figures in tool results", () => {
  const METRIC_INPUT = { assessmentId: "go-no-go", metricId: "medianRt" }
  const firstOutput = async (tool: string, input: object) => {
    const { model } = scriptedModel(() => [
      { tool: "getUserContext", input: { reason: "Review" } },
      { tool, input: { reason: "Check", ...input } },
      "Done.",
    ])
    const result = await createInvestigationAgent(model).generate({
      prompt: "Go.",
    })
    return result.steps[1]?.toolResults[0]?.output as Record<string, unknown>
  }
  const isRounded = (value: number) => value === Number(value.toPrecision(4))

  it("rounds a relationship but stores it at full precision", async () => {
    await seedPlantedRelationship()

    const output = await firstOutput("analyzePerformance", {
      mode: "relationship",
      factorId: "sleep.hours",
      ...METRIC_INPUT,
    })

    const stored = await analyses.get(output.analysisId as string)
    expect(isRounded(output.effect as number)).toBe(true)
    expect(isRounded(stored!.effect!)).toBe(false)
    expect(output.effect).toBe(Number(stored!.effect!.toPrecision(4)))
    expect(output.grade).toBe(stored!.grade)
  })

  it("rounds a baseline comparison", async () => {
    await seedPlantedRelationship()

    const output = await firstOutput("analyzePerformance", {
      mode: "baseline",
      ...METRIC_INPUT,
    })

    expect(isRounded(output.latest as number)).toBe(true)
  })

  it("rounds measurements but leaves the stored runs alone", async () => {
    await seedPlantedRelationship()

    const output = (await firstOutput("getMeasurements", {
      assessmentId: "go-no-go",
    })) as {
      recent: { measurementId: string; metrics: { medianRt: number } }[]
    }

    const [run] = output.recent
    const stored = await measurements.get(run!.measurementId)
    expect(isRounded(run!.metrics.medianRt)).toBe(true)
    expect(isRounded(stored!.metrics.medianRt!)).toBe(false)
  })
})

describe("history sent to the model", () => {
  const twoSteps = () =>
    scriptedModel(() => [
      { tool: "getUserContext", input: { reason: "Review" } },
      "Done.",
    ])

  it("drops old tool results and keeps the current turn's", async () => {
    const { model, prompts } = twoSteps()

    await createInvestigationAgent(model).generate({
      messages: [...earlierTurns(5), { role: "user", content: "Now" }],
    })

    expect(prompts).toHaveLength(2)
    expect(toolResultIds(prompts[0])).toEqual([])
    // The second step still sees what the first step's tool returned.
    expect(toolResultIds(prompts[1])).toEqual(["call-0"])
    const text = JSON.stringify(prompts[1])
    expect(text).not.toContain("old-")
    expect(text).toContain("Earlier answer 4")
    expect(text).toContain("Now")
  })

  it("keeps the instructions on every step", async () => {
    const { model, prompts } = twoSteps()

    await createInvestigationAgent(model).generate({
      messages: [...earlierTurns(2), { role: "user", content: "Now" }],
    })

    for (const prompt of prompts as { role: string }[][]) {
      expect(prompt[0]?.role).toBe("system")
    }
  })

  it("doesn't grow with the length of the session", async () => {
    const promptSize = async (turns: number) => {
      const { model, prompts } = twoSteps()
      await createInvestigationAgent(model).generate({
        messages: [...earlierTurns(turns), { role: "user", content: "Now" }],
      })
      return JSON.stringify(prompts[0]).length
    }

    const atFive = await promptSize(5)
    expect(await promptSize(50)).toBeLessThan(atFive + 50)
  })

  it("does the same when streaming, which is how the app calls it", async () => {
    const prompts: unknown[] = []
    const finish = (unified: "stop" | "tool-calls") =>
      ({
        type: "finish",
        finishReason: { unified, raw: undefined },
        usage: USAGE,
      }) as const
    const model = new MockLanguageModelV4({
      doStream: async (options) => {
        prompts.push(options.prompt)
        return {
          stream:
            prompts.length === 1
              ? simulateReadableStream({
                  chunks: [
                    {
                      type: "tool-call",
                      toolCallId: "call-0",
                      toolName: "getUserContext",
                      input: JSON.stringify({ reason: "Review" }),
                    },
                    finish("tool-calls"),
                  ],
                })
              : simulateReadableStream({
                  chunks: [
                    { type: "text-start", id: "t" },
                    { type: "text-delta", id: "t", delta: "Done." },
                    { type: "text-end", id: "t" },
                    finish("stop"),
                  ],
                }),
        }
      },
    })

    const result = await createInvestigationAgent(model).stream({
      messages: [...earlierTurns(5), { role: "user", content: "Now" }],
    })
    await result.consumeStream()

    expect(prompts).toHaveLength(2)
    expect(toolResultIds(prompts[0])).toEqual([])
    expect(toolResultIds(prompts[1])).toEqual(["call-0"])
  })
})

describe("investigation agent", () => {
  it("runs the full cycle and pauses for the user", async () => {
    await seedPlantedRelationship()
    const metric = { assessmentId: "go-no-go", metricId: "medianRt" }

    const { model, offered } = scriptedModel((results) => {
      const plan = results.get("planInvestigation") as {
        investigationId: string
      }
      const hypothesis = results.get("manageHypotheses") as {
        hypothesisId: string
      }
      const analysis = results.get("analyzePerformance") as {
        analysisId: string
      }
      return [
        {
          tool: "getUserContext",
          input: { reason: "Review progress", questionIds: ["sleep.hours"] },
        },
        {
          tool: "planInvestigation",
          input: {
            reason: "A question worth testing",
            action: "create",
            title: "Sleep and speed",
            question: "Does sleep relate to my reaction time?",
            origin: "agent",
            objectives: ["Compare sleep with reaction time"],
            evidence: [{ factorId: "sleep.hours", ...metric, minPairs: 8 }],
          },
        },
        {
          tool: "manageHypotheses",
          input: {
            reason: "Sleep may matter",
            action: "create",
            investigationId: plan?.investigationId,
            statement: "More sleep comes with faster reactions",
            factorId: "sleep.hours",
            ...metric,
            expectedDirection: "negative",
          },
        },
        {
          tool: "analyzePerformance",
          input: {
            reason: "Test the hypothesis",
            mode: "relationship",
            factorId: "sleep.hours",
            ...metric,
          },
        },
        {
          tool: "evaluateEvidence",
          input: {
            reason: "Enough data to judge",
            hypothesisId: hypothesis?.hypothesisId,
            analysisIds: [analysis?.analysisId],
            observed: "You tend to react faster after more sleep.",
            uncertainty: "Other daily factors could also play a part.",
            nextStep: "Check whether stress changes this.",
          },
        },
        {
          tool: "saveInvestigation",
          input: {
            reason: "Remember progress",
            investigationId: plan?.investigationId,
            progressNote: "Sleep finding recorded. Stress is next.",
          },
        },
        {
          tool: "selectQuestions",
          input: {
            reason: "Stress could explain part of this",
            questionIds: ["stress.level"],
          },
        },
        "This should never be reached.",
      ]
    })

    const result = await createInvestigationAgent(model).generate({
      prompt: "Session started.",
    })

    // Stops as soon as the user has a task, without another model call.
    expect(offered).toHaveLength(7)

    // Permissions followed the cycle.
    expect(offered[0]?.sort()).toEqual(["getMeasurements", "getUserContext"])
    expect(offered[3]).not.toContain("evaluateEvidence")
    expect(offered[4]).toContain("evaluateEvidence")

    // The verdict came from the data, not the script.
    const [discovery] = await discoveries.list()
    expect(discovery?.verdict).toBe("supported")
    expect(discovery?.grade).toBe("strong")
    expect(discovery?.evidence).toMatch(/24 comparable sessions/)
    const [hypothesis] = await hypotheses.list()
    expect(hypothesis?.status).toBe("supported")

    // Everything persisted, ready to resume.
    const [investigation] = await investigations.list()
    expect(investigation?.progressNote).toMatch(/Stress is next/)
    const pending = await getPendingTask()
    expect(pending).toMatchObject({
      kind: "questions",
      questionIds: ["stress.level"],
      reason: "Stress could explain part of this",
    })

    // Every action was logged with its reason.
    const log = await decisions.list()
    expect(log).toHaveLength(7)
    expect(log.map((entry) => entry.reason)).toContain("Enough data to judge")
    expect(result.steps).toHaveLength(7)
  })

  it("reports insufficient evidence instead of a verdict", async () => {
    await seedPlantedRelationship(4)
    const metric = { assessmentId: "go-no-go", metricId: "medianRt" }

    const { model } = scriptedModel((results) => {
      const plan = results.get("planInvestigation") as {
        investigationId: string
      }
      const hypothesis = results.get("manageHypotheses") as {
        hypothesisId: string
      }
      const analysis = results.get("analyzePerformance") as {
        analysisId: string
        grade: string
      }
      return [
        { tool: "getUserContext", input: { reason: "Review" } },
        {
          tool: "planInvestigation",
          input: {
            reason: "Test this",
            action: "create",
            title: "Sleep",
            question: "Does sleep matter?",
            origin: "user",
            objectives: ["Collect data"],
            evidence: [{ factorId: "sleep.hours", ...metric, minPairs: 8 }],
          },
        },
        {
          tool: "manageHypotheses",
          input: {
            reason: "Testing",
            action: "create",
            investigationId: plan?.investigationId,
            statement: "Sleep helps",
            factorId: "sleep.hours",
            ...metric,
            expectedDirection: "any",
          },
        },
        {
          tool: "analyzePerformance",
          input: {
            reason: "Check",
            mode: "relationship",
            factorId: "sleep.hours",
            ...metric,
          },
        },
        {
          tool: "evaluateEvidence",
          input: {
            reason: "Trying to conclude",
            hypothesisId: hypothesis?.hypothesisId,
            analysisIds: [analysis?.analysisId],
            observed: "It looks like sleep helps a great deal.",
            uncertainty: "None.",
            nextStep: "Stop.",
          },
        },
        "Done.",
      ]
    })

    await createInvestigationAgent(model).generate({ prompt: "Go." })

    const [discovery] = await discoveries.list()
    expect(discovery?.grade).toBe("insufficient")
    expect(discovery?.verdict).toBe("inconclusive")
    expect((await hypotheses.list())[0]?.status).toBe("inconclusive")
  })

  it("won't stack a second task on a pending one", async () => {
    const select = {
      tool: "selectAssessment",
      input: { reason: "Next", assessmentId: "go-no-go" },
    }
    const first = scriptedModel(() => [
      { tool: "getUserContext", input: { reason: "Review" } },
      select,
    ])
    await createInvestigationAgent(first.model).generate({ prompt: "Go." })
    const pendingId = (await getPendingTask())?.id
    expect(pendingId).toBeDefined()

    const second = scriptedModel(() => [
      { tool: "getUserContext", input: { reason: "Review" } },
      { ...select, input: { reason: "Again", assessmentId: "visual-search" } },
      "Stopping.",
    ])
    await createInvestigationAgent(second.model).generate({ prompt: "Go." })

    expect((await getPendingTask())?.id).toBe(pendingId)
    await clearPendingTask()
  })
})
