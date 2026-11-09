"use client"

import {
  PrivyProvider,
  useLoginWithOAuth,
  usePrivy,
  type User,
} from "@privy-io/react-auth"
import {
  useCreateWallet,
  useSignRawHash,
} from "@privy-io/react-auth/extended-chains"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import {
  expectMemoryAccount,
  setMemoryAccount,
} from "@/modules/agent-memory/api"
import { activateAccountDb } from "@/modules/memory/db"
import { syncMemory } from "@/modules/agent-memory/sync"

import { AccountContext, type Account } from "./account-context"

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID
/** Show a recovery action if Privy cannot finish loading. */
const READY_TIMEOUT_MS = 6000
/** Who was signed in on this browser last time, until they sign out. */
const RETURNING_USER_KEY = "tranquility:signedInUser"

function readReturningUser() {
  try {
    return localStorage.getItem(RETURNING_USER_KEY)
  } catch {
    return null
  }
}

function rememberReturningUser(userId: string | null) {
  try {
    if (userId) localStorage.setItem(RETURNING_USER_KEY, userId)
    else localStorage.removeItem(RETURNING_USER_KEY)
  } catch {
    // Without storage, every visit waits for Privy, which still works.
  }
}

const noSubscription = () => () => {}

function findSuiWallet(user: User | null) {
  for (const linked of user?.linkedAccounts ?? []) {
    if (linked.type === "wallet" && linked.chainType === "sui") return linked
  }
  return null
}

function AccountBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy()
  const { createWallet } = useCreateWallet()
  const { signRawHash } = useSignRawHash()
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

  /** Signed in, as Privy has confirmed. */
  const confirmedId = ready && authenticated ? (user?.id ?? null) : null
  const returningId = useSyncExternalStore(
    noSubscription,
    readReturningUser,
    () => null
  )
  // Everything this app shows is in this browser, so someone who was signed in
  // last time opens straight to their research while Privy restores the
  // session. Privy's answer replaces this guess as soon as it has one.
  const userId = ready ? confirmedId : returningId

  useEffect(() => {
    if (ready) rememberReturningUser(confirmedId)
  }, [ready, confirmedId])

  const [storage, setStorage] = useState<{
    userId: string
    ready: boolean
  } | null>(null)
  const activation = useRef<{ userId: string; promise: Promise<void> } | null>(
    null
  )

  useEffect(() => {
    if (userId && activation.current && activation.current.userId !== userId) {
      // Clear in-flight work and browser singletons before mounting another user.
      window.location.reload()
      return
    }
    if (!userId) return
    activation.current ??= { userId, promise: activateAccountDb(userId) }
    let active = true
    activation.current.promise.then(
      () => {
        if (active) setStorage({ userId, ready: true })
      },
      () => {
        if (active) setStorage({ userId, ready: false })
      }
    )
    return () => {
      active = false
    }
  }, [userId])

  // Memory needs Privy's tokens and wallet, so it waits for the confirmation.
  const activeUserId =
    confirmedId && storage?.userId === confirmedId && storage.ready
      ? confirmedId
      : null

  // Privy's latest functions, for memory to use whenever it gets to them.
  const privy = useRef({ user, createWallet, signRawHash })
  useEffect(() => {
    privy.current = { user, createWallet, signRawHash }
  }, [user, createWallet, signRawHash])

  // An early agent turn on a returning visit waits for memory, not without it.
  useLayoutEffect(() => {
    expectMemoryAccount(
      ready ? confirmedId !== null && !activeUserId : returningId !== null
    )
  }, [ready, returningId, confirmedId, activeUserId])

  // A layout effect, so it's set before any screen's own effects can use memory.
  useLayoutEffect(() => {
    setMemoryAccount(
      activeUserId
        ? {
            userId: activeUserId,
            getToken: getAccessToken,
            getWallet: async () => {
              const { user, createWallet } = privy.current
              const wallet =
                findSuiWallet(user) ??
                findSuiWallet((await createWallet({ chainType: "sui" })).user)
              if (!wallet) throw new Error("No Sui wallet")
              const { address, publicKey } = wallet
              return {
                address,
                publicKey,
                signRawHash: async (hash) => {
                  const { signature } = await privy.current.signRawHash({
                    address,
                    chainType: "sui",
                    hash,
                  })
                  return signature
                },
              }
            },
          }
        : null
    )
  }, [activeUserId, getAccessToken])

  // Memory starts by itself as soon as someone is signed in, on any page.
  useEffect(() => {
    if (!activeUserId) return
    void syncMemory()
    const resume = () => void syncMemory({ opportunistic: true })
    // Leaving sends what's waiting, so another device can pick up from it.
    const leave = () => void syncMemory({ flush: true })
    const visibility = () =>
      document.visibilityState === "hidden" ? leave() : resume()
    window.addEventListener("online", resume)
    window.addEventListener("focus", resume)
    window.addEventListener("pagehide", leave)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      window.removeEventListener("online", resume)
      window.removeEventListener("focus", resume)
      window.removeEventListener("pagehide", leave)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [activeUserId])

  const value = useMemo<Account>(
    () => ({
      available: ready || !timedOut,
      ready: ready || timedOut,
      authenticated: userId !== null,
      storage:
        storage && storage.userId === userId
          ? storage.ready
            ? "ready"
            : "error"
          : "loading",
      email: user?.google?.email ?? user?.email?.address ?? null,
      signingIn: loading,
      signInFailed,
      signIn: () => {
        setSignInFailed(false)
        initOAuth({ provider: "google" }).catch(() => setSignInFailed(true))
      },
      signOut: () => {
        rememberReturningUser(null)
        // A full reload, so the running agent's conversation ends with it.
        void logout().finally(() => window.location.replace("/"))
      },
    }),
    [
      ready,
      timedOut,
      userId,
      storage,
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
        // The only wallet anyone gets is the Sui one memory creates when needed.
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
