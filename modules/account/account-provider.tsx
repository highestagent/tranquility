"use client"

import {
  PrivyProvider,
  useLoginWithOAuth,
  usePrivy,
} from "@privy-io/react-auth"
import { useEffect, useMemo, useState } from "react"

import { setMemoryAccount } from "@/modules/agent-memory/api"
import { syncMemory } from "@/modules/agent-memory/sync"

import { AccountContext, type Account } from "./account-context"

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID
/** After this, stop waiting on Privy: the app is local-first and still works. */
const READY_TIMEOUT_MS = 6000

function AccountBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy()
  const [signInFailed, setSignInFailed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  // Mounted at the root so it can finish the sign-in when Google returns here.
  const { initOAuth, loading } = useLoginWithOAuth({
    onError: () => setSignInFailed(true),
  })

  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready])

  const userId = authenticated ? (user?.id ?? null) : null

  // Memory starts by itself as soon as someone is signed in, on any page.
  useEffect(() => {
    setMemoryAccount(userId ? { userId, getToken: getAccessToken } : null)
    if (!userId) return
    void syncMemory()
    const onOnline = () => void syncMemory()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [userId, getAccessToken])

  const value = useMemo<Account>(
    () => ({
      available: ready || !timedOut,
      ready: ready || timedOut,
      authenticated,
      email: user?.google?.email ?? user?.email?.address ?? null,
      signingIn: loading,
      signInFailed,
      signIn: () => {
        setSignInFailed(false)
        initOAuth({ provider: "google" }).catch(() => setSignInFailed(true))
      },
      signOut: () => {
        // A full reload, so the running agent's conversation ends with it.
        void logout().finally(() => window.location.replace("/"))
      },
    }),
    [
      ready,
      timedOut,
      authenticated,
      user,
      loading,
      signInFailed,
      initOAuth,
      logout,
    ]
  )

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  )
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  if (!APP_ID) return children
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["google"],
        // Accounts here are for identity. No wallets are created.
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <AccountBridge>{children}</AccountBridge>
    </PrivyProvider>
  )
}
