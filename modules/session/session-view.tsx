"use client"

import { useCallback, useEffect, useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { getAiConsent, setAiConsent } from "@/modules/agent/consent"

import { AgentHome } from "./agent-home"
import { RestingWithoutAi } from "./resting-without-ai"
import { Welcome } from "./welcome"

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
    case "ask":
      return <Welcome onChoose={(granted) => void choose(granted)} />
    case "declined":
      return <RestingWithoutAi onWake={() => void choose(true)} />
    case "granted":
      return <AgentHome />
  }
}
