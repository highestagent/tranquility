import { Button } from "@/components/ui/button"

export function LoadingMessage({
  children = "Loading…",
}: {
  children?: string
}) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function StorageError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm">
      <p>
        Your data couldn&apos;t be read from this browser. Private windows and
        some settings block storage.
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
    <div className="flex flex-col items-start gap-2 border border-dashed border-border p-4 text-sm">
      <p className="font-medium">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}
