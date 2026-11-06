"use client"

import { createContext, useContext } from "react"

export interface Account {
  /** Accounts can work here: Privy is configured and reachable. */
  available: boolean
  /** The sign-in state is known. */
  ready: boolean
  authenticated: boolean
  email: string | null
  signingIn: boolean
  signInFailed: boolean
  signIn: () => void
  signOut: () => void
}

/** With no accounts available, the app simply runs on this device. */
export const NO_ACCOUNT: Account = {
  available: false,
  ready: true,
  authenticated: false,
  email: null,
  signingIn: false,
  signInFailed: false,
  signIn: () => undefined,
  signOut: () => undefined,
}

export const AccountContext = createContext<Account>(NO_ACCOUNT)

export function useAccount() {
  return useContext(AccountContext)
}
