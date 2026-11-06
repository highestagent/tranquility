import { PageHeader } from "@/components/page-header"
import { InsightsView } from "@/modules/insights/insights-view"
import { InvestigationsView } from "@/modules/investigation/investigations-view"

export default function FindingsPage() {
  return (
    <>
      <PageHeader title="Findings" />
      <InvestigationsView />
      <InsightsView />
    </>
  )
}
