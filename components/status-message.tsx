import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"

export function LoadingMessage({
  children = "Loading…",
}: {
  children?: string
}) {
  return (
    <p role="status" className="py-8 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function StorageError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-1 flex-col">
      <Screen
        title="I can't read this browser's storage."
        dock={
          onRetry ? (
            <Button size="cta" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      >
        <p className="text-sm text-muted-foreground">
          Private windows can block it.
        </p>
      </Screen>
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
    <div className="flex flex-col gap-1 rounded-3xl border border-dashed border-border p-5 text-sm">
      <p className="font-medium">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}
