import { ClipboardList, Gamepad2, MessageCircle } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { PendingTask } from "@/modules/agent/pending-task"
import { getAssessment } from "@/modules/assessments"

const SHOW_ONLY = new Set(["EvidenceCard", "PastFindingCard", "ChartView"])

/** What the task is, how long it takes, and why, before it opens. */
function describe(task: PendingTask) {
  switch (task.kind) {
    case "questions": {
      const count = task.questionIds.length
      return {
        Icon: ClipboardList,
        title: count === 1 ? "One quick question" : `${count} quick questions`,
        detail:
          count <= 6
            ? "Under a minute"
            : `About ${Math.ceil(count / 6)} minutes`,
      }
    }
    case "assessment": {
      const assessment = getAssessment(task.assessmentId)
      const minutes = Math.max(
        1,
        Math.round((assessment?.approxSeconds ?? 60) / 60)
      )
      return {
        Icon: Gamepad2,
        title: assessment?.shortName ?? "A short game",
        detail: `About ${minutes} ${minutes === 1 ? "minute" : "minutes"}`,
      }
    }
    case "interaction":
      return {
        Icon: MessageCircle,
        title: task.message,
        detail: SHOW_ONLY.has(task.interaction.type)
          ? "Something to show you"
          : "One question",
      }
  }
}

export function TaskInvitation({ task }: { task: PendingTask }) {
  const { Icon, title, detail } = describe(task)
  return (
    <Card className="gap-3 rounded-3xl p-4 pl-5 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-pretty">{title}</p>
          <p className="text-muted-foreground">{detail}</p>
        </div>
      </div>
      <p className="text-pretty text-muted-foreground">{task.reason}</p>
    </Card>
  )
}
