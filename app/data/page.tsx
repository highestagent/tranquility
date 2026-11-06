import { PageHeader } from "@/components/page-header"
import { DataView } from "@/modules/memory/data-view"

export default function DataPage() {
  return (
    <>
      <PageHeader
        title="Your data"
        description="Inspect, export, import, or delete everything Tranquility has stored."
      />
      <DataView />
    </>
  )
}
