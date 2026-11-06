"use client"

import { ClipboardList } from "lucide-react"
import { useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import {
  askedThisSession,
  coreQuestionIds,
  resolveQuestions,
} from "@/modules/questionnaire"
import { QuestionFlow } from "@/modules/questionnaire/question-flow"

async function loadCheckIn() {
  return resolveQuestions(coreQuestionIds(), await askedThisSession())
}

/** The core questions, for logging data without the agent. */
export function CheckIn() {
  const { state, reload } = useAsync(loadCheckIn)
  const [open, setOpen] = useState(false)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  if (state.data.length === 0) return null
  if (open) {
    return (
      <QuestionFlow
        questionIds={state.data}
        onDone={() => {
          setOpen(false)
          void reload()
        }}
      />
    )
  }
  return (
    <Button
      size="lg"
      variant="outline"
      className="self-start"
      onClick={() => setOpen(true)}
    >
      <ClipboardList aria-hidden data-icon="inline-start" />
      Check in
    </Button>
  )
}
