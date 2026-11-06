"use client"

import { useRef, useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"

import { getDb, STORE_NAMES, type StoreName } from "./db"
import {
  countAll,
  deleteAll,
  exportAll,
  importAll,
  InvalidImportError,
} from "./portability"

const STORE_LABELS: Record<StoreName, string> = {
  sessions: "Sessions",
  measurements: "Game results",
  responses: "Answers",
  investigations: "Investigations",
  hypotheses: "Hypotheses",
  analyses: "Analyses",
  discoveries: "Findings",
  decisions: "Agent decisions",
  kv: "Settings and state",
}

type Notice = { kind: "info" | "error"; text: string } | null

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function DataView() {
  const { state, reload } = useAsync(countAll)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  const counts = state.data

  async function runExport() {
    try {
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(await exportAll(), `tranquility-${date}.json`)
      setNotice({ kind: "info", text: "Export downloaded." })
    } catch {
      setNotice({ kind: "error", text: "The export failed. Try again." })
    }
  }

  async function runImport(file: File) {
    setImportFile(null)
    try {
      await importAll(JSON.parse(await file.text()))
      setNotice({ kind: "info", text: `Imported ${file.name}.` })
      await reload()
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof InvalidImportError || error instanceof SyntaxError
            ? "That file isn't a valid Tranquility export. Nothing was changed."
            : "The import failed. Nothing was changed.",
      })
    }
  }

  async function runDelete() {
    setConfirmDelete(false)
    try {
      await deleteAll()
      setNotice({ kind: "info", text: "Everything was deleted." })
      await reload()
    } catch {
      setNotice({ kind: "error", text: "The delete failed. Try again." })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        Everything is stored only in this browser, which can clear it without
        warning. Export a copy regularly to keep it safe.
      </p>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error" ? "text-sm text-destructive" : "text-sm"
          }
        >
          {notice.text}
        </p>
      ) : null}

      <section aria-labelledby="stored" className="flex flex-col gap-2">
        <h2 id="stored" className="font-medium">
          What&apos;s stored
        </h2>
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {STORE_NAMES.map((name) => (
            <StoreInspector key={name} name={name} count={counts[name]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="portable" className="flex flex-col gap-3">
        <h2 id="portable" className="font-medium">
          Export and import
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => void runExport()}>
            Export everything
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            Import a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Import file"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              setImportFile(event.target.files?.[0] ?? null)
              event.target.value = ""
            }}
          />
        </div>
        {importFile ? (
          <div
            role="alertdialog"
            aria-label="Confirm import"
            className="flex flex-col items-start gap-3 border border-border p-3 text-sm"
          >
            <p>
              Replace everything on this device with {importFile.name}? Export a
              copy first if you want to keep what&apos;s here.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => void runImport(importFile)}>
                Replace my data
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setImportFile(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="delete" className="flex flex-col gap-3">
        <h2 id="delete" className="font-medium">
          Delete
        </h2>
        {confirmDelete ? (
          <div
            role="alertdialog"
            aria-label="Confirm delete"
            className="flex flex-col items-start gap-3 border border-destructive p-3 text-sm"
          >
            <p>
              Permanently delete all results, answers, investigations, and
              settings from this browser? This can&apos;t be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                variant="destructive"
                onClick={() => void runDelete()}
              >
                Delete everything
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="lg"
            variant="destructive"
            className="self-start"
            onClick={() => setConfirmDelete(true)}
          >
            Delete everything…
          </Button>
        )}
      </section>
    </div>
  )
}

function StoreInspector({ name, count }: { name: StoreName; count: number }) {
  const [rows, setRows] = useState<unknown[] | null>(null)

  return (
    <details
      className="py-2 text-sm"
      onToggle={(event) => {
        if (event.currentTarget.open && rows === null) {
          void getDb()
            .then((db) => db.getAll(name))
            .then(setRows)
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <span>{STORE_LABELS[name]}</span>
        <span className="font-mono text-xs tabular-nums">{count}</span>
      </summary>
      {rows ? (
        <pre className="mt-2 max-h-80 overflow-auto bg-muted p-2 font-mono text-xs">
          {JSON.stringify(rows, null, 2)}
        </pre>
      ) : null}
    </details>
  )
}
