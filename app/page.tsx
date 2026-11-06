import { SessionView } from "@/modules/session/session-view"

export default function SessionPage() {
  return (
    <>
      <SessionView />
      <p className="text-xs text-muted-foreground">
        Tranquility is not a medical tool and doesn&apos;t diagnose anything.
      </p>
    </>
  )
}
