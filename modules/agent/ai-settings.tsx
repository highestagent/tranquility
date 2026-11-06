"use client"

import { Cloud } from "lucide-react"
import { useEffect, useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { cn } from "@/lib/utils"

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

  if (failed) return <StorageError />
  if (granted === null) return <LoadingMessage />

  return (
    <section className="flex flex-col gap-3 rounded-3xl p-4 pl-5 surface">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Cloud aria-hidden className="size-5" />
        </span>
        <h2 id="cloud-ai" className="flex-1 text-sm font-medium">
          Cloud AI
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={granted}
          aria-labelledby="cloud-ai"
          onClick={() => void change(!granted)}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            granted ? "bg-glow" : "bg-input"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1 left-1 size-5 rounded-full bg-background shadow-sm transition-transform duration-200",
              granted && "translate-x-5"
            )}
          />
        </button>
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          What gets sent
        </summary>
        <div className="mt-2">
          <AiDisclosure />
        </div>
      </details>
    </section>
  )
}
