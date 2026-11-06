"use client"

import { Cloud, Lock, Smartphone } from "lucide-react"

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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  )
}

/** First run: what this is, and the one decision that matters. */
export function Welcome({
  useGoogle,
  signingIn,
  signInFailed,
  onBegin,
  onWithoutAi,
}: {
  /** Begin signs in with Google. Without accounts, it just starts. */
  useGoogle: boolean
  signingIn: boolean
  signInFailed: boolean
  onBegin: () => void
  onWithoutAi: () => void
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
            Your answers and results stay on this device
          </p>
          <p className="flex items-center gap-2.5">
            <Lock aria-hidden className="size-4 shrink-0" />
            What it learns is kept encrypted, across devices
          </p>
          <p className="flex items-center gap-2.5">
            <Cloud aria-hidden className="size-4 shrink-0" />
            Cloud AI sees only what it asks for
          </p>
          {signInFailed ? (
            <p role="alert" className="pt-1 text-destructive">
              Google sign-in didn&apos;t finish. Try again.
            </p>
          ) : null}
        </div>
      }
      dock={
        <>
          <Button size="cta" disabled={signingIn} onClick={onBegin}>
            {useGoogle ? <GoogleMark /> : null}
            {signingIn
              ? "Opening Google…"
              : useGoogle
                ? "Begin with Google"
                : "Begin"}
          </Button>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={onWithoutAi}
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
