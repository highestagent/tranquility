"use client"

import { Brain } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useAccount } from "@/modules/account/account-context"

import { NotSignedInError, verifyMemoryAccount } from "./api"
import {
  forgetMemories,
  getMemoryCount,
  getMemoryState,
  onMemoryChange,
  onSyncPass,
  type MemoryState,
} from "./sync"
import type { MemoryVerification } from "./tatum"

/** Memory just works, so this exists for transparency and control. */
export function MemorySettings() {
  const account = useAccount()
  const [state, setState] = useState<MemoryState | null>(null)
  /** What the account holds. `null` until known, since a new browser has no idea. */
  const [saved, setSaved] = useState<number | "failed" | null>(null)

  const refresh = useCallback(() => {
    getMemoryState().then(setState, () => setState(null))
    // Until the session is confirmed there's no account to ask yet, which
    // isn't a failure: the next sync pass refreshes this.
    getMemoryCount().then(setSaved, (error) =>
      setSaved(error instanceof NotSignedInError ? null : "failed")
    )
  }, [])

  const { authenticated } = account
  useEffect(() => {
    if (!authenticated) return
    refresh()
    // Refreshes when sync has news, rather than asking the relayer itself.
    const stopPasses = onSyncPass(refresh)
    const stopChanges = onMemoryChange(refresh)
    return () => {
      stopPasses()
      stopChanges()
    }
  }, [authenticated, refresh])

  if (!account.available || !authenticated || !state) return null

  const status =
    state.failing || saved === "failed"
      ? "Can't connect right now. It'll keep trying"
      : state.pending.length > 0
        ? "Saving…"
        : saved === null
          ? "Checking…"
          : saved === 1
            ? "1 memory saved"
            : `${saved} memories saved`

  return (
    <Card className="gap-3 rounded-3xl p-4 pl-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Brain aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="agent-memory" className="text-sm font-medium">
            Agent memory
          </h2>
          <p role="status" className="truncate text-sm text-muted-foreground">
            {status}
          </p>
        </div>
      </div>
      <VerifyAccount />
      <Disclosure onForgot={refresh} />
    </Card>
  )
}

const VERIFICATION_STATUS = {
  checking: "Checking the account on Sui mainnet…",
  verified: "Verified on Sui mainnet through Tatum.",
  not_ready:
    "Your account is still being set up. Try again after memory syncs.",
  unconfigured: "Tatum verification is unavailable on this deployment.",
  mismatch: "The onchain account could not be verified for your wallet.",
  failed: "Couldn’t verify the account right now. Try again.",
}

function VerifyAccount() {
  const [result, setResult] = useState<
    MemoryVerification | "checking" | "failed" | null
  >(null)
  const status = typeof result === "string" ? result : result?.status

  async function verify() {
    setResult("checking")
    try {
      setResult(await verifyMemoryAccount())
    } catch {
      setResult("failed")
    }
  }

  return (
    <div className="text-xs text-muted-foreground">
      <Button
        variant="link"
        size="sm"
        type="button"
        className="h-auto justify-start px-0 text-xs"
        disabled={status === "checking"}
        onClick={() => void verify()}
      >
        Verify account on Sui
      </Button>
      <p role="status">{status ? VERIFICATION_STATUS[status] : ""}</p>
      {typeof result === "object" && result?.status === "verified" ? (
        <p className="mt-1 break-all">
          Account ID <code>{result.accountId}</code>
        </p>
      ) : null}
    </div>
  )
}

function Disclosure({ onForgot }: { onForgot: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [forgetFailed, setForgetFailed] = useState(false)

  async function forget() {
    setForgetFailed(false)
    try {
      await forgetMemories()
      setConfirming(false)
      onForgot()
    } catch {
      setForgetFailed(true)
    }
  }

  return (
    <Collapsible className="text-sm text-muted-foreground">
      <CollapsibleTrigger className="cursor-pointer rounded text-left text-xs underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-2 focus-visible:outline-ring">
        What it keeps
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col items-start gap-3">
          <p className="text-pretty">
            Your investigations, findings, corrections, and what you ask it to
            remember sync to Walrus Memory on mainnet, so the agent can pick up
            on any device you sign in to. The service can read these notes while
            storing and searching them. Answers and game results stay in this
            browser.
          </p>
          {confirming ? (
            <div className="flex flex-col gap-2">
              <p className="text-pretty text-foreground">
                The agent will stop recalling everything saved so far, on every
                device. Encrypted copies stay on Walrus until they expire.
              </p>
              {forgetFailed ? (
                <p role="alert" className="text-destructive">
                  That didn&apos;t work. Try again.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => void forget()}
                >
                  Forget
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="link"
              size="sm"
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forget what it has saved
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
