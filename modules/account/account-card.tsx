"use client"

import { LogOut, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"

import { useAccount } from "./account-context"

export function AccountCard() {
  const account = useAccount()
  if (!account.available) return null

  return (
    <section className="flex items-center gap-3 rounded-3xl p-4 pl-5 surface">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <UserRound aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="truncate text-sm text-muted-foreground">
          {account.authenticated
            ? (account.email ?? "Signed in")
            : "Not signed in"}
        </p>
      </div>
      {account.authenticated ? (
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Sign out"
          title="Sign out"
          className="-mr-1"
          onClick={account.signOut}
        >
          <LogOut aria-hidden />
        </Button>
      ) : (
        <Button
          size="lg"
          variant="outline"
          disabled={account.signingIn}
          onClick={account.signIn}
        >
          Sign in
        </Button>
      )}
    </section>
  )
}
