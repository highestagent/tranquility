import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import { z } from "zod"
import type { Question } from "@/modules/questionnaire/bank"

const label = z.string().min(1).max(500)
const options = z
  .array(label)
  .min(2)
  .max(12)
  .refine((v) => new Set(v).size === v.length)
export const componentProps = {
  BinaryChoice: z.object({ label }).strict(),
  SingleSelect: z.object({ label, options }).strict(),
  MultiSelect: z.object({ label, options }).strict(),
  ScaleInput: z.object({ label, low: label, high: label }).strict(),
  NumberInput: z
    .object({
      label,
      min: z.number(),
      max: z.number(),
      step: z.number().positive(),
      unit: label,
    })
    .strict()
    .refine((v) => v.max > v.min),
  TextInput: z.object({ label, placeholder: z.string().max(200) }).strict(),
  AssessmentCard: z.object({ assessmentId: label }).strict(),
  EvidenceCard: z.object({ discoveryId: label }).strict(),
  PastFindingCard: z.object({ reference: label }).strict(),
  ChartView: z.object({ assessmentId: label, metricId: label }).strict(),
  ConsentPrompt: z.object({ label, disclosure: label }).strict(),
}
export type ComponentName = keyof typeof componentProps
export const interactionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("BinaryChoice"),
      props: componentProps.BinaryChoice,
    })
    .strict(),
  z
    .object({
      type: z.literal("SingleSelect"),
      props: componentProps.SingleSelect,
    })
    .strict(),
  z
    .object({
      type: z.literal("MultiSelect"),
      props: componentProps.MultiSelect,
    })
    .strict(),
  z
    .object({ type: z.literal("ScaleInput"), props: componentProps.ScaleInput })
    .strict(),
  z
    .object({
      type: z.literal("NumberInput"),
      props: componentProps.NumberInput,
    })
    .strict(),
  z
    .object({ type: z.literal("TextInput"), props: componentProps.TextInput })
    .strict(),
  z
    .object({
      type: z.literal("AssessmentCard"),
      props: componentProps.AssessmentCard,
    })
    .strict(),
  z
    .object({
      type: z.literal("EvidenceCard"),
      props: componentProps.EvidenceCard,
    })
    .strict(),
  z
    .object({
      type: z.literal("PastFindingCard"),
      props: componentProps.PastFindingCard,
    })
    .strict(),
  z
    .object({ type: z.literal("ChartView"), props: componentProps.ChartView })
    .strict(),
  z
    .object({
      type: z.literal("ConsentPrompt"),
      props: componentProps.ConsentPrompt,
    })
    .strict(),
])
export type Interaction = z.infer<typeof interactionSchema>
export type Answer = string | number | boolean | string[] | null
export const catalog = defineCatalog(schema, {
  components: {
    BinaryChoice: {
      props: componentProps.BinaryChoice,
      description: "Yes or no; advances immediately.",
    },
    SingleSelect: {
      props: componentProps.SingleSelect,
      description: "One option; advances immediately.",
    },
    MultiSelect: {
      props: componentProps.MultiSelect,
      description: "Multiple options; confirm explicitly.",
    },
    ScaleInput: {
      props: componentProps.ScaleInput,
      description: "A five-point contextual rating.",
    },
    NumberInput: {
      props: componentProps.NumberInput,
      description: "A bounded quantity; confirm explicitly.",
    },
    TextInput: {
      props: componentProps.TextInput,
      description: "Open-ended context; confirm explicitly.",
    },
    AssessmentCard: {
      props: componentProps.AssessmentCard,
      description: "A registered, unchanged assessment protocol.",
    },
    EvidenceCard: {
      props: componentProps.EvidenceCard,
      description: "A finding loaded from evaluated local evidence.",
    },
    PastFindingCard: {
      props: componentProps.PastFindingCard,
      description: "A saved finding recalled from Walrus Memory, by reference.",
    },
    ChartView: {
      props: componentProps.ChartView,
      description: "History from stored measurements only.",
    },
    ConsentPrompt: {
      props: componentProps.ConsentPrompt,
      description: "Explicit contextual permission.",
    },
  },
  actions: {},
})
export function questionInteraction(question: Question): Interaction {
  const label = question.prompt
  switch (question.kind.type) {
    case "yes-no":
      return { type: "BinaryChoice", props: { label } }
    case "scale":
      return {
        type: "ScaleInput",
        props: { label, low: question.kind.low, high: question.kind.high },
      }
    case "number": {
      const { min, max, step, unit } = question.kind
      return { type: "NumberInput", props: { label, min, max, step, unit } }
    }
  }
}
export function validAnswer(interaction: Interaction, value: Answer): boolean {
  if (value === null) return true
  switch (interaction.type) {
    case "BinaryChoice":
    case "ConsentPrompt":
      return typeof value === "boolean"
    case "ScaleInput":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 5
      )
    case "NumberInput": {
      const { min, max, step } = interaction.props
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= min &&
        value <= max &&
        Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-8
      )
    }
    case "SingleSelect":
      return (
        typeof value === "string" && interaction.props.options.includes(value)
      )
    case "MultiSelect":
      return (
        Array.isArray(value) &&
        new Set(value).size === value.length &&
        value.every((v) => interaction.props.options.includes(v))
      )
    case "TextInput":
      return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 2000
      )
    default:
      return value === true
  }
}
