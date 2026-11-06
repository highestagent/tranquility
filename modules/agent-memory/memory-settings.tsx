"use client"

import { Brain } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAccount } from "@/modules/account/account-context"

import {
  forgetMemories,
  getMemoryState,
  getSavedCount,
  setMemoryEnabled,
  type MemoryState,
} from "./sync"

/** Memory just works, so this exists only for transparency and control. */
export function MemorySettings() {
  const account = useAccount()
  const [state, setState] = useState<MemoryState | null>(null)
  /** What the account holds. `null` until known, since a new browser has no idea. */
  const [saved, setSaved] = useState<number | "off" | "failed" | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [forgetFailed, setForgetFailed] = useState(false)

  const refresh = useCallback(() => {
    getMemoryState().then(setState, () => setState(null))
    getSavedCount().then(
      (count) => setSaved(count ?? "off"),
      () => setSaved("failed")
    )
  }, [])

  const { authenticated } = account
  useEffect(() => {
    if (authenticated) refresh()
  }, [authenticated, refresh])

  if (!account.available || !authenticated || !state) return null

  const status =
    !state.enabled || saved === "off"
      ? "Off"
      : state.failing || saved === "failed"
        ? "Can't connect right now. It'll keep trying"
        : state.pending.length > 0
          ? "Saving…"
          : saved === null
            ? "Checking…"
            : saved === 1
              ? "1 memory saved"
              : `${saved} memories saved`

  async function forget() {
    setForgetFailed(false)
    try {
      await forgetMemories()
      setConfirming(false)
      refresh()
    } catch {
      setForgetFailed(true)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl p-4 pl-5 surface">
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
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-labelledby="agent-memory"
          onClick={() => void setMemoryEnabled(!state.enabled).then(refresh)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            state.enabled ? "bg-glow" : "bg-input"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1 left-1 size-5 rounded-full bg-background shadow-sm transition-transform duration-200",
              state.enabled && "translate-x-5"
            )}
          />
        </button>
      </div>
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          What it keeps
        </summary>
        <div className="mt-2 flex flex-col items-start gap-3">
          <p className="text-pretty">
            The agent&apos;s findings and progress notes, so it can pick up
            where it left off on any device. Your answers and game results stay
            on this device.
          </p>
          {confirming ? (
            <div className="flex flex-col gap-2">
              <p className="text-pretty text-foreground">
                The agent will stop recalling everything saved so far. Encrypted
                copies stay on Walrus until they expire, because Walrus Memory
                can&apos;t erase them sooner.
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
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forget what it has saved
            </button>
          )}
        </div>
      </details>
    </section>
  )
}
