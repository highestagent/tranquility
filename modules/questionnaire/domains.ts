import {
  Activity,
  Coffee,
  Moon,
  Smile,
  Volume2,
  type LucideIcon,
} from "lucide-react"

import type { QuestionDomain } from "./bank"

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
