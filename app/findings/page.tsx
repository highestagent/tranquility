import { PageHeader } from "@/components/page-header"
import { FindingsView } from "@/modules/insights/findings-view"

export default function FindingsPage() {
  return (
    <>
      <PageHeader title="Findings" />
      <FindingsView />
    </>
  )
}
