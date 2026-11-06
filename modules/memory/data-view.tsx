"use client"

import {
  CalendarDays,
  ChartScatter,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Gamepad2,
  History,
  Lightbulb,
  Settings2,
  Telescope,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { useRef, useState } from "react"

import { Section } from "@/components/screen"
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

/** What most people care about. The rest is one tap away. */
const HEADLINE_STORES: StoreName[] = ["sessions", "measurements", "responses"]

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
      await reload()
    } catch {
      setNotice({ kind: "error", text: "The delete failed." })
    }
  }

  return (
    <>
      <Section label="Stored on this device">
        <dl className="grid grid-cols-3 gap-3">
          {HEADLINE_STORES.map((name) => (
            <div key={name} className="flex flex-col gap-0.5">
              <dd className="font-mono text-2xl tabular-nums">
                {counts[name]}
              </dd>
              <dt className="text-xs text-muted-foreground">
                {STORES[name].label}
              </dt>
            </div>
          ))}
        </dl>
        <p className="text-xs text-pretty text-muted-foreground">
          Browsers can clear storage, so export a copy regularly.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="cta" onClick={() => void runExport()}>
            <Download aria-hidden data-icon="inline-start" />
            Export
          </Button>
          <Button
            size="cta"
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden data-icon="inline-start" />
            Import
          </Button>
        </div>
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
        {importFile ? (
          <div
            role="alertdialog"
            aria-label="Confirm import"
            className="rise-in flex flex-col gap-3 rounded-2xl border border-border p-4 text-sm"
          >
            <p>Replace everything here with {importFile.name}?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={() => void runImport(importFile)}>
                Replace
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
      </Section>

      <Section label="Everything stored">
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {STORE_NAMES.map((name) => (
            <li key={name}>
              <StoreRow name={name} count={counts[name]} />
            </li>
          ))}
        </ul>
      </Section>

      {confirmDelete ? (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          className="rise-in flex flex-col gap-3 rounded-2xl border border-destructive p-4 text-sm"
        >
          <p>Permanently delete everything from this browser?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="destructive"
              onClick={() => void runDelete()}
            >
              Delete
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
          size="cta"
          variant="ghost"
          className="text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 aria-hidden data-icon="inline-start" />
          Delete everything
        </Button>
      )}
    </>
  )
}

function StoreRow({ name, count }: { name: StoreName; count: number }) {
  const [rows, setRows] = useState<unknown[] | null>(null)
  const { label, Icon } = STORES[name]

  return (
    <details
      className="group text-sm"
      onToggle={(event) => {
        if (event.currentTarget.open && rows === null) {
          void getDb()
            .then((db) => db.getAll(name))
            .then(setRows)
        }
      }}
    >
      <summary className="flex h-12 cursor-pointer list-none items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        <span className="flex-1">{label}</span>
        <span className="font-mono text-xs tabular-nums">{count}</span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      {rows ? (
        <pre className="mb-3 max-h-72 overflow-auto rounded-2xl bg-muted p-3 font-mono text-xs">
          {JSON.stringify(rows, null, 2)}
        </pre>
      ) : null}
    </details>
  )
}
