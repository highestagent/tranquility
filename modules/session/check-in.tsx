"use client"

import { useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { useAsync } from "@/hooks/use-async"
import {
  askedThisSession,
  coreQuestionIds,
  resolveQuestions,
} from "@/modules/questionnaire"
import { QuestionnaireForm } from "@/modules/questionnaire/questionnaire-form"

async function loadCheckIn() {
  return resolveQuestions(coreQuestionIds(), await askedThisSession())
}

/** The core questions, for anyone logging data without the agent. */
export function CheckIn() {
  const { state, reload } = useAsync(loadCheckIn)
  const [saved, setSaved] = useState(false)

  return (
    <section aria-labelledby="check-in" className="flex flex-col gap-3">
      <h2 id="check-in" className="font-medium">
        Check in
      </h2>
      {state.status === "loading" ? <LoadingMessage /> : null}
      {state.status === "error" ? (
        <StorageError onRetry={() => void reload()} />
      ) : null}
      {state.status === "ready" ? (
        state.data.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {saved
              ? "Saved. Play an assessment now to compare it with these answers."
              : "You've already checked in this session."}
          </p>
        ) : (
          <QuestionnaireForm
            questionIds={state.data}
            onDone={() => {
              setSaved(true)
              void reload()
            }}
          />
        )
      ) : null}
    </section>
  )
}
