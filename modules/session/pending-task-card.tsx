"use client"

import type { PendingTask } from "@/modules/agent/pending-task"
import { AssessmentRunner } from "@/modules/assessments/runner/assessment-runner"
import type { Measurement } from "@/modules/memory"
import { QuestionnaireForm } from "@/modules/questionnaire/questionnaire-form"

export function PendingTaskCard({
  task,
  onQuestionsDone,
  onAssessmentDone,
}: {
  task: PendingTask
  onQuestionsDone: (answered: number) => void
  onAssessmentDone: (measurement: Measurement | null) => void
}) {
  return (
    <section aria-label="Your next step" className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="text-muted-foreground">Why this: </span>
        {task.reason}
      </p>
      {task.kind === "questions" ? (
        <QuestionnaireForm
          key={task.id}
          questionIds={task.questionIds}
          onDone={onQuestionsDone}
          submitLabel="Continue"
        />
      ) : (
        <AssessmentRunner
          key={task.id}
          assessmentId={task.assessmentId}
          onFinish={onAssessmentDone}
          doneLabel="Continue"
        />
      )}
    </section>
  )
}
