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
import { useEffect, useRef, useState } from "react"

import { Section } from "@/components/screen"
import { StorageError } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { localDate } from "@/lib/utils"
import { useAccount } from "@/modules/account/account-context"
import {
  getBackupStatus,
  onMemoryChange,
  onSyncPass,
} from "@/modules/agent-memory/sync"

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

/** Where the encrypted backup stands, in a few words. */
function describeBackup(
  status: { lastBackupAt: number | null; uploading: boolean },
  now: number
) {
  if (status.uploading) return "Backing up to Walrus, encrypted…"
  if (status.lastBackupAt === null) {
    return "Backs up to Walrus, encrypted, once there are answers or game results."
  }
  const minutes = Math.round((now - status.lastBackupAt) / 60_000)
  const format = new Intl.RelativeTimeFormat([], { numeric: "auto" })
  const ago =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? format.format(-minutes, "minute")
        : minutes < 48 * 60
          ? format.format(-Math.round(minutes / 60), "hour")
          : format.format(-Math.round(minutes / (24 * 60)), "day")
  return `Backed up to Walrus, encrypted, ${ago}.`
}

export function DataView() {
  const { state, reload } = useAsync(countAll)
  const account = useAccount()
  const [backup, setBackup] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = () =>
      getBackupStatus().then(
        (status) => setBackup(describeBackup(status, Date.now())),
        () => setBackup(null)
      )
    void load()
    const stopPasses = onSyncPass(() => void load())
    // A backup restored onto this device changes what's here.
    const stopChanges = onMemoryChange(() => void reload())
    return () => {
      stopPasses()
      stopChanges()
    }
  }, [reload])

  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  // Laid out before the counts arrive, so nothing below moves when they do.
  const counts = state.status === "ready" ? state.data : null

  async function runExport() {
    try {
      downloadJson(await exportAll(), `tranquility-${localDate()}.json`)
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
      // Signed in, a device with nothing on it restores the backup at once.
      account.signOut()
    } catch {
      setNotice({ kind: "error", text: "The delete failed." })
    }
  }

  return (
    <Section label="On this device">
      <Card className="gap-4 rounded-3xl p-5">
        <dl className="grid grid-cols-3 gap-3">
          {HEADLINE_STORES.map((name) => (
            <div key={name} className="flex flex-col gap-0.5">
              <dd className="font-mono text-2xl tabular-nums">
                {counts ? counts[name] : "–"}
              </dd>
              <dt className="text-xs text-muted-foreground">
                {STORES[name].label}
              </dt>
            </div>
          ))}
        </dl>
        <p className="text-xs text-pretty text-muted-foreground">
          {backup ?? "Browsers can clear storage, so export a copy regularly."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            variant="outline"
            className="rounded-full"
            onClick={() => void runExport()}
          >
            <Download aria-hidden data-icon="inline-start" />
            Export
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full"
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
        <Collapsible>
          <CollapsibleTrigger className="cursor-pointer rounded text-left text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-2 focus-visible:outline-ring">
            Everything stored
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {STORE_NAMES.map((name) => (
                <li key={name}>
                  <StoreRow name={name} count={counts?.[name] ?? null} />
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </Card>

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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogTrigger
          render={
            <Button
              size="lg"
              variant="ghost"
              className="self-start text-destructive"
            />
          }
        >
          <Trash2 aria-hidden data-icon="inline-start" />
          Delete from this browser
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              Delete everything from this browser and sign out? Your encrypted
              backup stays on Walrus and comes back when you sign in again. To
              stop the agent recalling what it saved, use Agent memory above.
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
    </Section>
  )
}

function StoreRow({ name, count }: { name: StoreName; count: number | null }) {
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
          {count ?? "–"}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {rows ? (
          <pre className="mb-3 max-h-72 overflow-y-auto rounded-2xl bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
