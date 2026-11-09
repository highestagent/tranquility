"use client"

import Image from "next/image"

import { Sheet } from "@/components/sheet"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { useAccount } from "./account-context"

export function AccountGate({ children }: { children: React.ReactNode }) {
  const account = useAccount()
  if (account.authenticated && account.storage === "ready") return children

  const loading =
    !account.ready || (account.authenticated && account.storage === "loading")
  const unavailable = !account.available || account.storage === "error"

  return (
    <main className="dark flex min-h-svh w-full items-center justify-center bg-background bg-[url('/signal-atlas.webp')] bg-cover bg-center px-6 py-12 text-center text-foreground">
      <div className="flex w-full max-w-lg flex-col items-center">
        <Image
          src="/tranquility.svg"
          alt=""
          width={88}
          height={88}
          className="mb-6 motion-safe:animate-[brand-breathe_6s_ease-in-out_infinite]"
        />
        <h1 className="voice-display">Tranquility</h1>
        <p className="mt-4 max-w-xs text-base leading-relaxed text-pretty text-muted-foreground">
          Notice what shapes your focus, memory, and attention.
        </p>

        <div className="mt-9 flex w-full max-w-xs flex-col items-center gap-3">
          {loading ? (
            <p
              role="status"
              className="flex min-h-12 items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner
                aria-hidden="true"
                className="motion-reduce:animate-none"
              />
              Opening Tranquility…
            </p>
          ) : unavailable ? (
            <>
              <p role="alert" className="text-sm text-muted-foreground">
                {account.storage === "error"
                  ? "We couldn’t open your saved research."
                  : "Sign-in is unavailable right now."}
              </p>
              <Button size="cta" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <Button
                size="cta"
                className="h-12 gap-2.5 rounded-xl bg-[#f2f2f2] text-sm text-[#1f1f1f] shadow-none hover:bg-white"
                disabled={account.signingIn}
                onClick={account.signIn}
              >
                <Image src="/google-g.svg" width={20} height={20} alt="" />
                {account.signingIn ? "Opening Google…" : "Continue with Google"}
              </Button>
              {account.signInFailed ? (
                <p role="alert" className="text-sm text-destructive">
                  Google sign-in didn’t finish. Try again.
                </p>
              ) : null}
              <Sheet
                title="How your data is handled"
                trigger={
                  <Button
                    variant="link"
                    size="sm"
                    className="min-h-11 text-muted-foreground hover:text-foreground"
                  >
                    How your data is handled
                  </Button>
                }
              >
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    Your agent’s findings and progress notes sync to Walrus
                    Memory, so it can recall them when you sign in on another
                    device. The service can read those notes while storing and
                    searching them.
                  </p>
                  <p>
                    Your answers and game results are stored in this browser. If
                    there’s unclaimed research here, it links to the first
                    account that signs in.
                  </p>
                </div>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
