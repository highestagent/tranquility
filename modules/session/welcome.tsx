"use client"

import { ArrowRight, Cloud, Smartphone } from "lucide-react"

import { HeroLayout } from "@/components/screen"
import { Sheet } from "@/components/sheet"
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
    <HeroLayout
      title="What shapes your mind?"
      titleClassName="voice-display"
      visual={
        <div className="w-full max-w-[min(100%,42svh)] lg:max-w-[min(100%,74svh)]">
          <KnowledgeMap knowledge={EMPTY} state="resting" />
        </div>
      }
      detail={
        <div className="flex flex-col gap-2 pt-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2.5">
            <Smartphone aria-hidden className="size-4 shrink-0" />
            Your history stays on this device
          </p>
          <p className="flex items-center gap-2.5">
            <Cloud aria-hidden className="size-4 shrink-0" />
            Cloud AI sees only what it asks for
          </p>
        </div>
      }
      dock={
        <>
          <Button size="cta" onClick={() => onChoose(true)}>
            Begin
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => onChoose(false)}
              className="h-11 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Continue without AI
            </button>
            <Sheet
              title="What gets sent"
              trigger={(open) => (
                <button
                  type="button"
                  onClick={open}
                  className="h-11 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  What gets sent
                </button>
              )}
            >
              <div className="flex flex-col gap-3">
                <AiDisclosure />
                <p className="text-sm text-muted-foreground">
                  Tranquility is not a medical tool.
                </p>
              </div>
            </Sheet>
          </div>
        </>
      }
    />
  )
}
