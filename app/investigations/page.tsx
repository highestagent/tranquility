import { PageHeader } from "@/components/page-header"
import { InvestigationsView } from "@/modules/investigation/investigations-view"

export default function InvestigationsPage() {
  return (
    <>
      <PageHeader
        title="Investigations"
        description="What the agent is looking into and the evidence it still needs."
      />
      <InvestigationsView />
    </>
  )
}
