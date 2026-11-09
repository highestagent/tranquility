import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"

export function LoadingMessage({
  children = "Loading…",
}: {
  children?: string
}) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
    >
      <Spinner aria-hidden className="motion-reduce:animate-none" />
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
    <Empty className="flex-none items-start rounded-3xl border bg-card text-left">
      <EmptyHeader className="items-start gap-1">
        <EmptyTitle className="voice-note not-italic">{title}</EmptyTitle>
        <EmptyDescription className="text-sm">{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
