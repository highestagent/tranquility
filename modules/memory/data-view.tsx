"use client"

import {
  Check,
  ClipboardList,
  Download,
  Gamepad2,
  History,
  Lightbulb,
  Settings2,
  Telescope,
  Trash2,
  Upload,
  Waypoints,
  ChartScatter,
  CalendarDays,
  type LucideIcon,
} from "lucide-react"
import { useRef, useState } from "react"

import { LoadingMessage, StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { cn } from "@/lib/utils"

import { getDb, STORE_NAMES, type StoreName } from "./db"
import {
  countAll,
  deleteAll,
  exportAll,
  importAll,
  InvalidImportError,
} from "./portability"

const STORES: Record<StoreName, { label: string; Icon: LucideIcon }> = {
  sessions: { label: "Sessions", Icon: CalendarDays },
  measurements: { label: "Game results", Icon: Gamepad2 },
  responses: { label: "Answers", Icon: ClipboardList },
  investigations: { label: "Investigations", Icon: Telescope },
  hypotheses: { label: "Hypotheses", Icon: Lightbulb },
  analyses: { label: "Analyses", Icon: ChartScatter },
  discoveries: { label: "Findings", Icon: Check },
  decisions: { label: "Agent decisions", Icon: History },
  kv: { label: "Settings", Icon: Settings2 },
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
  const [inspecting, setInspecting] = useState<StoreName | null>(null)
  const [rows, setRows] = useState<unknown[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  const counts = state.data

  async function inspect(name: StoreName) {
    if (inspecting === name) {
      setInspecting(null)
      return
    }
    setInspecting(name)
    setRows(null)
    try {
      const db = await getDb()
      setRows(await db.getAll(name))
    } catch {
      setNotice({ kind: "error", text: "Couldn't read that." })
    }
  }

  async function runExport() {
    try {
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(await exportAll(), `tranquility-${date}.json`)
      setNotice({ kind: "info", text: "Exported." })
    } catch {
      setNotice({ kind: "error", text: "The export failed." })
    }
  }

  async function runImport(file: File) {
    setImportFile(null)
    try {
      await importAll(JSON.parse(await file.text()))
      setNotice({ kind: "info", text: `Imported ${file.name}.` })
      setInspecting(null)
      await reload()
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof InvalidImportError || error instanceof SyntaxError
            ? "Not a Tranquility export. Nothing changed."
            : "The import failed. Nothing changed.",
      })
    }
  }

  async function runDelete() {
    setConfirmDelete(false)
    try {
      await deleteAll()
      setNotice({ kind: "info", text: "Everything was deleted." })
      setInspecting(null)
      await reload()
    } catch {
      setNotice({ kind: "error", text: "The delete failed." })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="What's stored" className="flex flex-col gap-3">
        <ul className="grid grid-cols-3 gap-2">
          {STORE_NAMES.map((name) => {
            const { label, Icon } = STORES[name]
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-expanded={inspecting === name}
                  aria-label={`${label}: ${counts[name]}`}
                  onClick={() => void inspect(name)}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring",
                    inspecting === name && "border-primary"
                  )}
                >
                  <Icon aria-hidden className="size-4 text-muted-foreground" />
                  <span className="font-mono text-lg tabular-nums">
                    {counts[name]}
                  </span>
                  <span className="text-center text-xs leading-tight text-muted-foreground">
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {inspecting && rows ? (
          <pre className="rise-in max-h-80 overflow-auto rounded-2xl bg-muted p-3 font-mono text-xs">
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : null}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Waypoints aria-hidden className="size-3.5 shrink-0" />
        Only in this browser, which can clear it. Export a copy regularly.
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

      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={() => void runExport()}>
          <Download aria-hidden data-icon="inline-start" />
          Export
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden data-icon="inline-start" />
          Import
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
        <Button
          size="lg"
          variant="destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 aria-hidden data-icon="inline-start" />
          Delete
        </Button>
      </div>

      {importFile ? (
        <div
          role="alertdialog"
          aria-label="Confirm import"
          className="rise-in flex flex-col items-start gap-3 rounded-2xl border border-border p-4 text-sm"
        >
          <p>Replace everything here with {importFile.name}?</p>
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

      {confirmDelete ? (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          className="rise-in flex flex-col items-start gap-3 rounded-2xl border border-destructive p-4 text-sm"
        >
          <p>Permanently delete everything from this browser?</p>
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
      ) : null}
    </div>
  )
}
