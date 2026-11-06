"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { AiConsentCard } from "@/modules/agent/ai-consent-card"
import { getAiConsent, setAiConsent } from "@/modules/agent/consent"

import { AgentSession } from "./agent-session"
import { CheckIn } from "./check-in"

type ConsentState = "loading" | "error" | "ask" | "declined" | "granted"

export function SessionView() {
  const [consent, setConsent] = useState<ConsentState>("loading")

  const load = useCallback(() => {
    getAiConsent().then(
      (stored) => {
        if (!stored) setConsent("ask")
        else setConsent(stored.granted ? "granted" : "declined")
      },
      () => setConsent("error")
    )
  }, [])

  useEffect(load, [load])

  async function choose(granted: boolean) {
    try {
      await setAiConsent(granted)
      setConsent(granted ? "granted" : "declined")
    } catch {
      setConsent("error")
    }
  }

  switch (consent) {
    case "loading":
      return <LoadingMessage />
    case "error":
      return <StorageError onRetry={load} />
    case "granted":
      return <AgentSession />
    case "ask":
      return (
        <AiConsentCard
          onAllow={() => void choose(true)}
          onDecline={() => void choose(false)}
        />
      )
    case "declined":
      return (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col items-start gap-3 border border-border p-4 text-sm">
            <p>
              Cloud AI is off, so the agent isn&apos;t running. You can still
              check in and{" "}
              <Link href="/assessments" className="underline">
                play assessments
              </Link>
              . Your results are kept on this device for whenever you want them
              analyzed.
            </p>
            <Button
              size="lg"
              variant="outline"
              onClick={() => void choose(true)}
            >
              Allow cloud AI
            </Button>
          </section>
          <CheckIn />
        </div>
      )
  }
}
