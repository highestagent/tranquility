import { PageHeader } from "@/components/page-header"
import { SessionView } from "@/modules/session/session-view"

export default function SessionPage() {
  return (
    <>
      <PageHeader
        title="Session"
        description="Tranquility investigates what shapes your thinking, one question at a time. Your data is stored only on this device."
      />
      <SessionView />
      <p className="text-xs text-muted-foreground">
        Tranquility is not a medical tool and doesn&apos;t diagnose anything.
      </p>
    </>
  )
}
