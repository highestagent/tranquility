import { PageHeader } from "@/components/page-header"
import { AiSettings } from "@/modules/agent/ai-settings"
import { DataView } from "@/modules/memory/data-view"

export default function YouPage() {
  return (
    <>
      <PageHeader title="You" />
      <AiSettings />
      <DataView />
    </>
  )
}
