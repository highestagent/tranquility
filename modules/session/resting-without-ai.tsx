"use client"

import { Gamepad2, Power } from "lucide-react"
import Link from "next/link"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { loadKnowledge } from "@/modules/insights/knowledge"
import { KnowledgeMap, MapLegend } from "@/modules/insights/knowledge-map"

import { CheckIn } from "./check-in"

/** Cloud AI is off: the map and tools still work, and the agent sleeps. */
export function RestingWithoutAi({ onWake }: { onWake: () => void }) {
  const { state, reload } = useAsync(loadKnowledge)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  return (
    <div className="flex flex-col gap-5">
      <KnowledgeMap knowledge={state.data} state="asleep" />
      <MapLegend links={state.data.links} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={onWake}>
          <Power aria-hidden data-icon="inline-start" />
          Wake the agent
        </Button>
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/assessments" />}
        >
          <Gamepad2 aria-hidden data-icon="inline-start" />
          Games
        </Button>
      </div>
      <div className="flex justify-center">
        <CheckIn />
      </div>
    </div>
  )
}
