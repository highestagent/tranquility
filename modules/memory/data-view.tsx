"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
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
      // The running agent's conversation describes data that's now gone.
      window.location.reload()
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
      window.location.replace("/")
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
        <Input
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
          <Alert
            variant={notice.kind === "error" ? "destructive" : "default"}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialog
          open={importFile !== null}
          onOpenChange={(open) => {
            if (!open) setImportFile(null)
          }}
        >
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm import</AlertDialogTitle>
              <AlertDialogDescription>
                Replace everything here with {importFile?.name}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (importFile) void runImport(importFile)
                }}
              >
                Replace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      <Section label="Everything stored">
        <Card className="rounded-3xl px-5 py-0">
          <ul className="flex flex-col divide-y divide-border">
            {STORE_NAMES.map((name) => (
              <li key={name}>
                <StoreRow name={name} count={counts[name]} />
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogTrigger
          render={
            <Button size="cta" variant="ghost" className="text-destructive" />
          }
        >
          <Trash2 aria-hidden data-icon="inline-start" />
          Delete from this browser
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete everything from this browser? To stop the agent
              recalling what it saved, use Agent memory above.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void runDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function StoreRow({ name, count }: { name: StoreName; count: number }) {
  const [rows, setRows] = useState<unknown[] | null>(null)
  const { label, Icon } = STORES[name]

  return (
    <Collapsible
      className="group text-sm"
      onOpenChange={(open) => {
        if (open && rows === null) {
          void getDb()
            .then((db) => db.getAll(name))
            .then(setRows)
        }
      }}
    >
      <CollapsibleTrigger className="group flex h-12 w-full cursor-pointer list-none items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        <span className="flex-1">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {rows ? (
          <pre className="mb-3 max-h-72 overflow-auto rounded-2xl bg-muted p-3 font-mono text-xs">
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
