"use client"

import { ArrowRight, Cloud, Smartphone } from "lucide-react"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { AiDisclosure } from "@/modules/agent/ai-consent-card"
import { buildKnowledge } from "@/modules/insights/knowledge"
import { KnowledgeMap } from "@/modules/insights/knowledge-map"

const EMPTY = buildKnowledge({
  responses: [],
  measurements: [],
  analyses: [],
  hypotheses: [],
})

/** First run: what this is, and the one decision that matters. */
export function Welcome({
  onChoose,
}: {
  onChoose: (useCloudAi: boolean) => void
}) {
  return (
    <Screen
      title="What shapes your mind?"
      titleClassName="voice-display italic"
      dock={
        <>
          <Button size="cta" onClick={() => onChoose(true)}>
            Begin with cloud AI
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
          <Button size="cta" variant="ghost" onClick={() => onChoose(false)}>
            Without AI
          </Button>
        </>
      }
    >
      <div className="my-auto">
        <KnowledgeMap knowledge={EMPTY} state="resting" />
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-3">
            <Smartphone aria-hidden className="size-4 shrink-0" />
            Your history stays on this device
          </li>
          <li className="flex items-center gap-3">
            <Cloud aria-hidden className="size-4 shrink-0" />
            Cloud AI sees only what it asks for
          </li>
        </ul>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            What gets sent · Not a medical tool
          </summary>
          <div className="mt-3">
            <AiDisclosure />
          </div>
        </details>
      </div>
    </Screen>
  )
}
