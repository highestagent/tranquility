"use client"

import { Download } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

/** Builds the PDF only when asked, since the library is large. */
export function ReportButton() {
  const [state, setState] = useState<"idle" | "working" | "failed">("idle")

  async function download() {
    setState("working")
    try {
      const { downloadReport } = await import("./report")
      await downloadReport()
      setState("idle")
    } catch {
      setState("failed")
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        size="lg"
        className="rounded-full"
        disabled={state === "working"}
        onClick={() => void download()}
      >
        <Download aria-hidden data-icon="inline-start" />
        {state === "working" ? "Preparing report…" : "Download report (PDF)"}
      </Button>
      {state === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          The report couldn&apos;t be made. Try again.
        </p>
      ) : null}
    </div>
  )
}
