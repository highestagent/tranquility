"use client"

import { ClipboardList, Gamepad2, Power } from "lucide-react"
import Link from "next/link"

import { HeroLayout } from "@/components/screen"
import { StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { loadKnowledge } from "@/modules/insights/knowledge"
import { KnowledgeMap, MapLegend } from "@/modules/insights/knowledge-map"

import { HomeLoading } from "./agent-home"

/** Cloud AI is off: the map and tools still work, and the agent sleeps. */
export function RestingWithoutAi({ onWake }: { onWake: () => void }) {
  const { state, reload } = useAsync(loadKnowledge)

  if (state.status === "loading") return <HomeLoading />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  return (
    <HeroLayout
      title="The agent is asleep."
      visual={
        <div className="flex w-full max-w-[min(100%,44svh)] flex-col items-center gap-1 lg:max-w-[min(100%,74svh)]">
          <KnowledgeMap knowledge={state.data} state="asleep" />
          <MapLegend knowledge={state.data} />
        </div>
      }
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
    />
  )
}
