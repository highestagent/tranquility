"use client"

import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Cloud } from "lucide-react"
import { useEffect, useState } from "react"

import { StorageError } from "@/components/status-message"

import { AiDisclosure } from "./ai-consent-card"
import { isCloudAiEnabled, setAiConsent } from "./consent"

export function AiSettings() {
  const [granted, setGranted] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    isCloudAiEnabled()
      .then(setGranted)
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

  return (
    <Card className="gap-3 rounded-3xl p-4 pl-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Cloud aria-hidden className="size-5" />
        </span>
        <h2 id="cloud-ai" className="flex-1 text-sm font-medium">
          Cloud AI
        </h2>
        {/* Rendered before the setting is read, so the page doesn't move. */}
        <Switch
          checked={granted ?? false}
          disabled={granted === null}
          aria-labelledby="cloud-ai"
          onCheckedChange={(checked) => void change(checked)}
        />
      </div>
      <Collapsible>
        <CollapsibleTrigger className="cursor-pointer rounded text-left text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-2 focus-visible:outline-ring">
          What gets sent
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2">
            <AiDisclosure />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
