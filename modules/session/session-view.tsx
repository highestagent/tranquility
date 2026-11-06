"use client"

import { useCallback, useEffect, useState } from "react"

import { StorageError } from "@/components/status-message"
import { useAccount } from "@/modules/account/account-context"
import { getAiConsent, setAiConsent } from "@/modules/agent/consent"

import { AgentHome, HomeLoading } from "./agent-home"
import { homeView } from "./home-view"
import { RestingWithoutAi } from "./resting-without-ai"
import { Welcome } from "./welcome"

type ConsentState = "loading" | "error" | "ask" | "declined" | "granted"

export function SessionView() {
  const account = useAccount()
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

  /** One click: consent, then straight to Google and back to the agent. */
  async function begin() {
    await choose(true)
    if (account.available && !account.authenticated) account.signIn()
  }

  const view = homeView({
    consent,
    accountReady: account.ready,
    accountAvailable: account.available,
    authenticated: account.authenticated,
  })

  switch (view) {
    case "loading":
      return <HomeLoading />
    case "error":
      return <StorageError onRetry={load} />
    case "welcome":
      return (
        <Welcome
          useGoogle={account.available}
          signingIn={account.signingIn}
          signInFailed={account.signInFailed}
          onBegin={() => void begin()}
          onWithoutAi={() => void choose(false)}
        />
      )
    case "asleep":
      return <RestingWithoutAi onWake={() => void begin()} />
    case "agent":
      return <AgentHome />
  }
}
