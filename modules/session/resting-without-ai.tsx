"use client"

import { ClipboardList, Gamepad2, Power } from "lucide-react"
import Link from "next/link"

import { Screen } from "@/components/screen"
import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { loadKnowledge } from "@/modules/insights/knowledge"
import { KnowledgeMap, MapLegend } from "@/modules/insights/knowledge-map"

/** Cloud AI is off: the map and tools still work, and the agent sleeps. */
export function RestingWithoutAi({ onWake }: { onWake: () => void }) {
  const { state, reload } = useAsync(loadKnowledge)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  return (
    <Screen
      title="The agent is asleep."
      dock={
        <>
          <Button size="cta" onClick={onWake}>
            <Power aria-hidden data-icon="inline-start" />
            Wake it
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="cta"
              variant="outline"
              nativeButton={false}
              render={<Link href="/check-in" />}
            >
              <ClipboardList aria-hidden data-icon="inline-start" />
              Check in
            </Button>
            <Button
              size="cta"
              variant="outline"
              nativeButton={false}
              render={<Link href="/assessments" />}
            >
              <Gamepad2 aria-hidden data-icon="inline-start" />
              Games
            </Button>
          </div>
        </>
      }
    >
      <div className="my-auto flex flex-col gap-3">
        <KnowledgeMap knowledge={state.data} state="asleep" />
        <MapLegend links={state.data.links} />
      </div>
    </Screen>
  )
}
