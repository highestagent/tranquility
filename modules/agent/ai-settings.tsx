"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

import { AiDisclosure } from "./ai-consent-card"
import { getAiConsent, setAiConsent } from "./consent"

export function AiSettings() {
  const [granted, setGranted] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getAiConsent()
      .then((consent) => setGranted(consent?.granted ?? false))
      .catch(() => setFailed(true))
  }, [])

  async function change(next: boolean) {
    try {
      await setAiConsent(next)
      setGranted(next)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This setting couldn&apos;t be read or saved. Check that browser storage
        is enabled.
      </p>
    )
  }
  if (granted === null) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading…
      </p>
    )
  }

  return (
    <section
      aria-labelledby="ai-settings"
      className="flex flex-col gap-4 border border-border p-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="ai-settings" className="font-medium">
          Cloud AI
        </h2>
        <p role="status" className="text-sm text-muted-foreground">
          {granted ? "Allowed" : "Off"}
        </p>
      </div>
      <AiDisclosure />
      <Button
        size="lg"
        variant={granted ? "outline" : "default"}
        className="self-start"
        onClick={() => void change(!granted)}
      >
        {granted ? "Turn off" : "Allow"}
      </Button>
    </section>
  )
}
