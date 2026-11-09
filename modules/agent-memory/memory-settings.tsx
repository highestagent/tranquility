"use client"

import { Brain } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { useAccount } from "@/modules/account/account-context"

import {
  listPreferences,
  removePreference,
  savePreference,
  type Preference,
} from "./preferences"
import { MAX_PREFERENCE_CHARS } from "./records"
import {
  forgetMemories,
  getMemoryOverview,
  getMemoryState,
  onMemoryChange,
  onSyncPass,
  type MemoryOverview,
  type MemoryState,
} from "./sync"

const STATUS_LABEL = { active: "Active", paused: "Paused", completed: "Done" }

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/** Memory just works, so this exists for transparency and control. */
export function MemorySettings() {
  const account = useAccount()
  const [state, setState] = useState<MemoryState | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  /** What the account holds. `null` until known, since a new browser has no idea. */
  const [overview, setOverview] = useState<MemoryOverview | "failed" | null>(
    null
  )

  const refresh = useCallback(() => {
    getMemoryState().then(setState, () => setState(null))
    listPreferences().then(setPreferences, () => undefined)
    getMemoryOverview().then(setOverview, () => setOverview("failed"))
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

  const known = overview && overview !== "failed" ? overview : null
  const status =
    state.failing || overview === "failed"
      ? "Can't connect right now. It'll keep trying"
      : state.pending.length > 0
        ? "Saving…"
        : !known
          ? "Checking…"
          : known.investigations.length +
                known.findings +
                preferences.length ===
              0
            ? "Nothing saved yet"
            : "Synced across your devices"

  return (
    <Card className="gap-5 rounded-3xl p-4 pl-5">
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

      <Preferences
        preferences={preferences}
        synced={known?.preferences}
        onChange={refresh}
      />

      {known ? <Research overview={known} /> : null}

      <Disclosure onForgot={refresh} />
    </Card>
  )
}

function Preferences({
  preferences,
  synced,
  onChange,
}: {
  preferences: Preference[]
  synced?: MemoryOverview["preferences"]
  onChange: () => void
}) {
  const [draft, setDraft] = useState("")
  const [failed, setFailed] = useState(false)

  async function remember(event: React.FormEvent) {
    event.preventDefault()
    setFailed(false)
    try {
      await savePreference(draft)
      setDraft("")
      onChange()
    } catch {
      setFailed(true)
    }
  }

  return (
    <section aria-labelledby="remembered" className="flex flex-col gap-3">
      <h3 id="remembered" className="text-xs text-muted-foreground">
        Remembered for you
      </h3>
      {preferences.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {preferences.map((preference) => (
            <PreferenceRow
              key={preference.id}
              preference={preference}
              saving={
                synced
                  ? !synced.some(
                      ({ id, synced: done }) => id === preference.id && done
                    )
                  : false
              }
              onChange={onChange}
            />
          ))}
        </ul>
      ) : null}
      <form onSubmit={(event) => void remember(event)} className="flex gap-2">
        <label htmlFor="remember-this" className="sr-only">
          Something to remember
        </label>
        <Input
          id="remember-this"
          value={draft}
          maxLength={MAX_PREFERENCE_CHARS}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Mornings work best for check-ins"
          className="h-11 rounded-full px-4 text-sm md:text-sm"
        />
        <Button
          type="submit"
          size="lg"
          variant="outline"
          disabled={!draft.trim()}
          className="rounded-full"
        >
          Remember this
        </Button>
      </form>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          That didn&apos;t save. Try again.
        </p>
      ) : null}
    </section>
  )
}

function PreferenceRow({
  preference,
  saving,
  onChange,
}: {
  preference: Preference
  saving: boolean
  onChange: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(preference.text)
  const [failed, setFailed] = useState(false)

  async function run(work: () => Promise<unknown>) {
    setFailed(false)
    try {
      await work()
      setEditing(false)
      onChange()
    } catch {
      setFailed(true)
    }
  }

  if (editing)
    return (
      <li>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => savePreference(text, preference.id))
          }}
        >
          <label htmlFor={`preference-${preference.id}`} className="sr-only">
            Edit what to remember
          </label>
          <Input
            id={`preference-${preference.id}`}
            value={text}
            maxLength={MAX_PREFERENCE_CHARS}
            onChange={(event) => setText(event.target.value)}
            className="h-11 rounded-full px-4 text-sm md:text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!text.trim()}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(preference.text)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              That didn&apos;t save. Try again.
            </p>
          ) : null}
        </form>
      </li>
    )

  return (
    <li className="flex items-start gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="text-pretty break-words">{preference.text}</p>
        {saving ? (
          <p className="text-xs text-muted-foreground">Saving…</p>
        ) : null}
        {failed ? (
          <p role="alert" className="text-xs text-destructive">
            That didn&apos;t work. Try again.
          </p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditing(true)}
        aria-label={`Edit “${preference.text}”`}
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void run(() => removePreference(preference.id))}
        aria-label={`Remove “${preference.text}”`}
      >
        Remove
      </Button>
    </li>
  )
}

function Research({ overview }: { overview: MemoryOverview }) {
  const { investigations, findings, withdrawn } = overview
  if (investigations.length === 0 && findings === 0) return null
  return (
    <section aria-labelledby="synced-research" className="flex flex-col gap-2">
      <h3 id="synced-research" className="text-xs text-muted-foreground">
        Research it can pick up anywhere
      </h3>
      {investigations.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {investigations.map((row) => (
            <li key={row.id} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate">{row.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]} ·{" "}
                {row.synced ? "Synced" : "Saving…"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-pretty text-muted-foreground">
        {plural(findings, "finding", "findings")} saved
        {withdrawn > 0
          ? `, ${plural(withdrawn, "withdrawn after a correction", "withdrawn after corrections")}`
          : ""}
        . To correct one, correct the answer behind it in{" "}
        <Link
          href="/journal"
          className="rounded underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Journal
        </Link>
        .
      </p>
    </section>
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
