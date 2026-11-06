import {
  Activity,
  BatteryMedium,
  BedDouble,
  BellRing,
  Briefcase,
  Coffee,
  Dumbbell,
  Moon,
  Smile,
  Utensils,
  Volume2,
  Wine,
  type LucideIcon,
} from "lucide-react"

import type { Question, QuestionDomain } from "./bank"

export const DOMAINS: readonly {
  id: QuestionDomain
  label: string
  Icon: LucideIcon
}[] = [
  { id: "sleep", label: "Sleep", Icon: Moon },
  { id: "mood", label: "Mood", Icon: Smile },
  { id: "stress", label: "Stress", Icon: Activity },
  { id: "lifestyle", label: "Habits", Icon: Coffee },
  { id: "environment", label: "Space", Icon: Volume2 },
]

export function getDomain(id: QuestionDomain) {
  return DOMAINS.find((domain) => domain.id === id)!
}

/** Questions that a picture of their domain would misdescribe. */
const QUESTION_ICONS: Partial<Record<string, LucideIcon>> = {
  "sleep.nap_today": BedDouble,
  "mood.energy": BatteryMedium,
  "stress.workload": Briefcase,
  "lifestyle.exercise_today": Dumbbell,
  "lifestyle.alcohol_last_night": Wine,
  "lifestyle.meal_recent": Utensils,
  "environment.interruptions": BellRing,
}

export function getQuestionIcon(question: Question) {
  return QUESTION_ICONS[question.id] ?? getDomain(question.domain).Icon
}
