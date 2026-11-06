"use client"

import { useRouter } from "next/navigation"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { Screen } from "@/components/screen"
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
export function CheckInFlow() {
  const router = useRouter()
  const { state, reload } = useAsync(loadCheckIn)
  const toGames = () => router.push("/assessments")

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  if (state.data.length === 0) {
    return (
      <Screen
        title="You've already checked in."
        dock={
          <Button size="cta" onClick={toGames}>
            Games
          </Button>
        }
      />
    )
  }
  return <QuestionFlow questionIds={state.data} onDone={toGames} />
}
