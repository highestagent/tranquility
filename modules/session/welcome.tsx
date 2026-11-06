"use client"

import { ArrowRight, Cloud, Smartphone } from "lucide-react"

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
    <div className="rise-in flex flex-1 flex-col gap-6">
      <KnowledgeMap knowledge={EMPTY} state="resting" />
      <h1 className="text-center font-voice text-4xl text-balance italic">
        What shapes your mind?
      </h1>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted p-3 text-center">
          <Smartphone aria-hidden className="size-5" />
          Your history stays here
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted p-3 text-center">
          <Cloud aria-hidden className="size-5" />
          Cloud AI sees only what it asks for
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={() => onChoose(true)}>
          Begin with cloud AI
          <ArrowRight aria-hidden data-icon="inline-end" />
        </Button>
        <Button size="lg" variant="outline" onClick={() => onChoose(false)}>
          Without AI
        </Button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-center text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          What gets sent
        </summary>
        <div className="mt-3">
          <AiDisclosure />
        </div>
      </details>
      <p className="mt-auto text-center text-xs text-muted-foreground">
        Not a medical tool.
      </p>
    </div>
  )
}
