"use client"

import { Button } from "@/components/ui/button"
import { AGENT_MODEL } from "@/modules/relay/config"

/** The disclosure shown before any data can leave this device. */
export function AiDisclosure() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        The investigation agent uses a cloud AI model (
        <code className="font-mono text-xs">{AGENT_MODEL}</code>
        ). To reason about your results, it sends these to the model provider
        through this app&apos;s server:
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>Answers and game scores the agent requests</li>
        <li>Your investigations, hypotheses, and any questions you type</li>
      </ul>
      <p>
        Raw trial data isn&apos;t sent. This app&apos;s server doesn&apos;t
        store or log the content, but the AI gateway and model provider handle
        it under their own data policies. Everything else stays in this browser.
      </p>
      <p className="text-muted-foreground">
        Games, questionnaires, statistics, and your data tools all work without
        this.
      </p>
    </div>
  )
}

export function AiConsentCard({
  onAllow,
  onDecline,
}: {
  onAllow: () => void
  onDecline?: () => void
}) {
  return (
    <section
      aria-labelledby="ai-consent"
      className="flex flex-col gap-4 border border-border p-4"
    >
      <h2 id="ai-consent" className="font-medium">
        Allow the agent to use cloud AI?
      </h2>
      <AiDisclosure />
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={onAllow}>
          Allow
        </Button>
        {onDecline ? (
          <Button size="lg" variant="outline" onClick={onDecline}>
            Not now
          </Button>
        ) : null}
      </div>
    </section>
  )
}
