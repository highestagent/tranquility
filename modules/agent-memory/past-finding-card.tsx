"use client"

import { CircleHelp, Database } from "lucide-react"
import { useCallback } from "react"

import { Card } from "@/components/ui/card"
import { useAsync } from "@/hooks/use-async"
import { StrengthMeter } from "@/modules/insights/strength-meter"
import { OUTCOME_LABELS, verdictOutcome } from "@/modules/investigation/verdict"

import { getRecalledNote } from "./recalled"

/** Walrus blob IDs are long, so show enough to tell them apart. */
function shortReference(reference: string) {
  return reference.length > 14
    ? `${reference.slice(0, 6)}…${reference.slice(-4)}`
    : reference
}

/** The saved note an answer drew on, with where it's stored. */
export function PastFindingCard({ reference }: { reference: string }) {
  const load = useCallback(() => getRecalledNote(reference), [reference])
  const { state } = useAsync(load)
  if (state.status === "loading") return <p role="status">Loading the note…</p>
  if (state.status === "error" || !state.data)
    return (
      <p className="text-sm text-muted-foreground">
        This note is no longer current.
      </p>
    )
  const note = state.data
  return (
    <Card className="gap-4 rounded-[1.75rem] p-5 text-sm">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          From your research,{" "}
          <time dateTime={new Date(note.createdAt).toISOString()}>
            {new Date(note.createdAt).toLocaleDateString([], {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        </span>
        <span className="rounded-full border px-2.5 py-0.5">
          {OUTCOME_LABELS[verdictOutcome(note)]}
        </span>
      </div>
      <h2 className="voice-title text-balance">{note.observed}</h2>
      {note.statement ? (
        <p className="text-pretty text-muted-foreground">{note.statement}</p>
      ) : null}
      <StrengthMeter grade={note.grade} />
      <p className="flex items-start gap-2.5 text-pretty text-muted-foreground">
        <CircleHelp aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="sr-only">Still uncertain: </span>
          {note.uncertainty}
        </span>
      </p>
      <p className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <Database aria-hidden className="size-3.5 shrink-0" />
        <span>
          Walrus Memory note{" "}
          <span className="font-mono" title={note.reference}>
            {shortReference(note.reference)}
          </span>
        </span>
      </p>
    </Card>
  )
}
