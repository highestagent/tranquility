"use client"

import Link from "next/link"
import {
  EmptyMessage,
  LoadingMessage,
  StorageError,
} from "@/components/status-message"
import { useAsync } from "@/hooks/use-async"
import { discoveries, hypotheses, type Discovery } from "@/modules/memory"

const VERDICT_LABELS: Record<Discovery["verdict"], string> = {
  supported: "Supported",
  refuted: "Not supported",
  inconclusive: "Inconclusive",
}

async function loadInsights() {
  const [rows, hypothesisRows] = await Promise.all([
    discoveries.list(),
    hypotheses.list(),
  ])
  const statements = new Map(hypothesisRows.map((h) => [h.id, h.statement]))
  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((discovery) => ({
      discovery,
      statement: statements.get(discovery.hypothesisId),
    }))
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-pretty">{children}</dd>
    </div>
  )
}

export function InsightsView() {
  const { state, reload } = useAsync(loadInsights)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  if (state.data.length === 0) {
    return (
      <EmptyMessage title="No findings yet">
        Findings appear once there&apos;s enough evidence to evaluate.{" "}
        <Link href="/" className="underline">
          Continue your session
        </Link>{" "}
        to collect more.
      </EmptyMessage>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {state.data.map(({ discovery, statement }) => (
          <li
            key={discovery.id}
            className="flex flex-col gap-4 border border-border p-4"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-medium text-balance">
                {statement ?? "Finding"}
              </h2>
              <span className="shrink-0 text-xs font-medium">
                {VERDICT_LABELS[discovery.verdict]}
              </span>
            </div>
            <dl className="flex flex-col gap-3">
              <Field label="What was observed">{discovery.observed}</Field>
              <Field label="Evidence">{discovery.evidence}</Field>
              <Field label="How reliable this is">
                {discovery.reliability}
              </Field>
              <Field label="What remains uncertain">
                {discovery.uncertainty}
              </Field>
              <Field label="What to look at next">{discovery.nextStep}</Field>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        These are patterns in your own data, not medical findings or diagnoses,
        and they don&apos;t show cause. If you&apos;re concerned about your
        health or thinking, talk to a qualified professional.
      </p>
    </>
  )
}
