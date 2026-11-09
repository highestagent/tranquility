"use client"

import { useCallback, useEffect, useState } from "react"

import { StorageError } from "@/components/status-message"
import { isCloudAiEnabled } from "@/modules/agent/consent"

import { AgentHome, HomeLoading } from "./agent-home"
import { RestingWithoutAi } from "./resting-without-ai"

export function SessionView() {
  const [enabled, setEnabled] = useState<boolean | "error" | null>(null)

  const load = useCallback(() => {
    isCloudAiEnabled().then(setEnabled, () => setEnabled("error"))
  }, [])

  useEffect(load, [load])

  if (enabled === null) return <HomeLoading />
  if (enabled === "error") return <StorageError onRetry={load} />
  return enabled ? <AgentHome /> : <RestingWithoutAi />
}
