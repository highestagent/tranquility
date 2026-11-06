/**
 * Question definitions are part of the measurement. To change a question's
 * meaning or scale, add a new ID and retire the old one, so that answers stay
 * comparable over time. All answers are stored as numbers.
 */
export const BANK_VERSION = 1

export type QuestionDomain =
  | "sleep"
  | "mood"
  | "stress"
  | "lifestyle"
  | "environment"

export type QuestionKind =
  | { type: "scale"; low: string; high: string }
  | { type: "number"; min: number; max: number; step: number; unit: string }
  | { type: "yes-no" }

export interface Question {
  id: string
  domain: QuestionDomain
  prompt: string
  kind: QuestionKind
  /** Core questions form the default check-in. */
  core: boolean
}

const rating = (low: string, high: string): QuestionKind => ({
  type: "scale",
  low,
  high,
})
const YES_NO: QuestionKind = { type: "yes-no" }

export const QUESTIONS = [
  {
    id: "sleep.hours",
    domain: "sleep",
    prompt: "How many hours did you sleep last night?",
    kind: { type: "number", min: 0, max: 16, step: 0.5, unit: "hours" },
    core: true,
  },
  {
    id: "sleep.quality",
    domain: "sleep",
    prompt: "How well did you sleep?",
    kind: rating("Very poorly", "Very well"),
    core: true,
  },
  {
    id: "sleep.nap_today",
    domain: "sleep",
    prompt: "Have you napped today?",
    kind: YES_NO,
    core: false,
  },
  {
    id: "mood.valence",
    domain: "mood",
    prompt: "How is your mood right now?",
    kind: rating("Very low", "Very good"),
    core: true,
  },
  {
    id: "mood.energy",
    domain: "mood",
    prompt: "How much energy do you have right now?",
    kind: rating("Very little", "A lot"),
    core: true,
  },
  {
    id: "stress.level",
    domain: "stress",
    prompt: "How stressed do you feel right now?",
    kind: rating("Not at all", "Extremely"),
    core: true,
  },
  {
    id: "stress.workload",
    domain: "stress",
    prompt: "How demanding has your day been so far?",
    kind: rating("Not at all", "Extremely"),
    core: false,
  },
  {
    id: "lifestyle.caffeine_cups",
    domain: "lifestyle",
    prompt: "How many caffeinated drinks have you had today?",
    kind: { type: "number", min: 0, max: 15, step: 1, unit: "drinks" },
    core: false,
  },
  {
    id: "lifestyle.caffeine_recent",
    domain: "lifestyle",
    prompt: "Have you had caffeine in the last two hours?",
    kind: YES_NO,
    core: false,
  },
  {
    id: "lifestyle.exercise_today",
    domain: "lifestyle",
    prompt: "Have you exercised today?",
    kind: YES_NO,
    core: false,
  },
  {
    id: "lifestyle.alcohol_last_night",
    domain: "lifestyle",
    prompt: "Did you drink alcohol last night?",
    kind: YES_NO,
    core: false,
  },
  {
    id: "lifestyle.meal_recent",
    domain: "lifestyle",
    prompt: "Have you eaten in the last three hours?",
    kind: YES_NO,
    core: false,
  },
  {
    id: "environment.noise",
    domain: "environment",
    prompt: "How noisy is it around you?",
    kind: rating("Silent", "Very noisy"),
    core: false,
  },
  {
    id: "environment.interruptions",
    domain: "environment",
    prompt: "Do you expect to be interrupted in the next few minutes?",
    kind: YES_NO,
    core: false,
  },
] as const satisfies readonly Question[]

export type QuestionId = (typeof QUESTIONS)[number]["id"]

export const QUESTION_IDS = QUESTIONS.map((question) => question.id) as [
  QuestionId,
  ...QuestionId[],
]

export const SCALE_POINTS = [1, 2, 3, 4, 5] as const

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id)
}

/** Returns an error message, or `null` if the answer fits the question. */
export function validateAnswer(question: Question, value: number) {
  if (!Number.isFinite(value)) return "Enter a number."
  const { kind } = question
  if (kind.type === "scale") {
    return (SCALE_POINTS as readonly number[]).includes(value)
      ? null
      : "Choose a point on the scale."
  }
  if (kind.type === "yes-no") {
    return value === 0 || value === 1 ? null : "Choose yes or no."
  }
  if (value < kind.min || value > kind.max) {
    return `Enter a value from ${kind.min} to ${kind.max}.`
  }
  return null
}
