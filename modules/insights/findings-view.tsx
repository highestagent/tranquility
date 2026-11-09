"use client"

import Link from "next/link"

import { Section } from "@/components/screen"
import {
  EmptyMessage,
  LoadingMessage,
  StorageError,
} from "@/components/status-message"
import { useAsync } from "@/hooks/use-async"
import {
  listInvestigationSummaries,
  updateInvestigation,
  type InvestigationSummary,
} from "@/modules/investigation"

import { DiscoveryCard } from "./discovery-card"
import { ReportButton } from "./report-button"
import { byImportance, loadDiscoveryViews } from "./discovery-data"
import { ThreadCard } from "./thread-card"

async function loadFindings() {
  const [threads, discoveries] = await Promise.all([
    listInvestigationSummaries(),
    loadDiscoveryViews(),
  ])
  return { threads, discoveries: discoveries.sort(byImportance) }
}

export function FindingsView() {
  const { state, reload } = useAsync(loadFindings)

  if (state.status === "loading") return <LoadingMessage />
  if (state.status === "error") {
    return <StorageError onRetry={() => void reload()} />
  }
  const { threads, discoveries } = state.data
  if (threads.length === 0 && discoveries.length === 0) {
    return (
      <EmptyMessage title="Nothing yet">
        <Link href="/" className="underline">
          Back to the agent
        </Link>
      </EmptyMessage>
    )
  }

  async function setStatus(id: string, status: InvestigationSummary["status"]) {
    await updateInvestigation(id, { status })
    await reload()
  }

  return (
    <div className="flex flex-col gap-8">
      <ReportButton />
      <div className="flex flex-col gap-4">
        {discoveries.length > 0 ? (
          discoveries.map((view) => (
            <DiscoveryCard key={view.discovery.id} view={view} />
          ))
        ) : (
          <EmptyMessage title="No findings yet">
            They appear once there&apos;s enough evidence.
          </EmptyMessage>
        )}
      </div>
      <div className="flex flex-col gap-8">
        {threads.length > 0 ? (
          <Section label="Investigations">
            <div className="flex flex-col gap-3">
              {threads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  investigation={thread}
                  onStatus={(status) => void setStatus(thread.id, status)}
                />
              ))}
            </div>
          </Section>
        ) : null}
        {discoveries.length > 0 ? (
          <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
            Patterns in your own data, not diagnoses, and they don&apos;t show
            cause. For health concerns, see a professional.
          </p>
        ) : null}
      </div>
    </div>
  )
}
