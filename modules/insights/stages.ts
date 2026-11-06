import {
  ChartScatter,
  Compass,
  Eye,
  Gamepad2,
  MessageCircleQuestion,
  Scale,
  type LucideIcon,
} from "lucide-react"

export type Stage =
  "understand" | "question" | "assess" | "analyze" | "reason" | "adapt"

export const STAGES: Record<Stage, { label: string; Icon: LucideIcon }> = {
  understand: { label: "Reviewing", Icon: Eye },
  question: { label: "Choosing a question", Icon: MessageCircleQuestion },
  assess: { label: "Choosing a game", Icon: Gamepad2 },
  analyze: { label: "Analyzing", Icon: ChartScatter },
  reason: { label: "Weighing the evidence", Icon: Scale },
  adapt: { label: "Planning ahead", Icon: Compass },
}
