import { Button } from "@/components/ui/button"

export function LoadingMessage({
  children = "Loading…",
}: {
  children?: string
}) {
  return (
    <p role="status" className="py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function StorageError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 py-8 text-center text-sm"
    >
      <p>
        Can&apos;t read this browser&apos;s storage. Private windows can block
        it.
      </p>
      {onRetry ? (
        <Button size="lg" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyMessage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border p-8 text-center text-sm">
      <p className="font-voice text-2xl">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}
