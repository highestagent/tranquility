import { PageHeader } from "@/components/page-header"
import { InsightsView } from "@/modules/insights/insights-view"

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Insights"
        description="What the evidence shows so far, and how far to trust it."
      />
      <InsightsView />
    </>
  )
}
