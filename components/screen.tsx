import { cn } from "@/lib/utils"

/**
 * Every screen has the same anatomy, so the eye always knows where to look:
 *
 *   eyebrow  why this is here (quiet)
 *   title    the one thing to read
 *   body     the one thing to look at
 *   dock     the one thing to do, in thumb reach
 *
 * Spacing rhythm: a 20px gutter (from the layout), 24px between regions, and
 * 12px within a group. Put details below the fold rather than beside the title.
 */
export function Screen({
  eyebrow,
  title,
  titleClassName = "voice-title",
  titleKey,
  live = false,
  action,
  children,
  dock,
}: {
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  titleClassName?: string
  /** Replays the entrance when the title changes. */
  titleKey?: string | null
  /** Announces title changes, for text that updates by itself. */
  live?: boolean
  /** One small control at the top right. */
  action?: React.ReactNode
  children?: React.ReactNode
  dock?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col">
      {eyebrow || title || action ? (
        <header className="flex items-start justify-between gap-3 pt-1 pb-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {eyebrow}
            {title ? (
              <h1
                key={titleKey ?? undefined}
                aria-live={live ? "polite" : undefined}
                className={cn("rise-in text-balance", titleClassName)}
              >
                {title}
              </h1>
            ) : null}
          </div>
          {action ? <div className="-mt-2 -mr-2 shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="flex flex-1 flex-col gap-6">{children}</div>
      {dock ? (
        <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-col gap-2 bg-linear-to-t from-background from-75% to-transparent px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {dock}
        </div>
      ) : (
        <div className="h-8 shrink-0" />
      )}
    </div>
  )
}

/** A labelled group within a screen's body. */
export function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      {children}
    </section>
  )
}
