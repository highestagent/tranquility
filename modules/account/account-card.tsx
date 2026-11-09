"use client"

import { LogOut, UserRound } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

import { useAccount } from "./account-context"

export function AccountCard() {
  const account = useAccount()
  if (!account.available) return null

  return (
    <Card className="flex-row items-center gap-3 rounded-3xl p-4 pl-5">
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
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Sign out"
                title="Sign out"
                className="-mr-1"
              />
            }
          >
            <LogOut aria-hidden />
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of Tranquility?</AlertDialogTitle>
              <AlertDialogDescription>
                You’ll need to sign in again to access your research.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
              <AlertDialogAction size="lg" onClick={account.signOut}>
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
    </Card>
  )
}
