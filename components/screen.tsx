import { cn } from "@/lib/utils"

const dockStyle =
  "sticky bottom-0 z-10 -mx-5 flex flex-col gap-2 bg-background px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"

/**
 * Every screen has the same anatomy, so the eye always knows where to look:
 *
 *   eyebrow  why this is here (quiet)
 *   title    the one thing to read
 *   body     the one thing to look at
 *   dock     the one thing to do, in thumb reach
 *
 * Spacing rhythm: a 20px gutter (from the layout), 24px between regions, and
 * 12px within a group. Screens are a reading width unless they're `wide`.
 */
export function Screen({
  eyebrow,
  title,
  titleClassName = "voice-title",
  titleKey,
  live = false,
  action,
  wide = false,
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
  wide?: boolean
  children?: React.ReactNode
  dock?: React.ReactNode
}) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-1 flex-col", !wide && "max-w-lg")}
    >
      {eyebrow || title || action ? (
        <header className="flex items-start justify-between gap-3 pt-2 pb-7">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
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
        <div className={cn(dockStyle, "mt-6")}>{dock}</div>
      ) : (
        <div className="h-10 shrink-0" />
      )}
    </div>
  )
}

/**
 * The agent's stage: its body and evidence beside what it's saying. Stacked on
 * a phone, with the action in thumb reach. Side by side on a larger screen, so
 * the visual never gets pushed out of view by a long reply.
 */
export function HeroLayout({
  visual,
  eyebrow,
  title,
  titleClassName = "voice-title",
  titleKey,
  live = false,
  detail,
  dock,
  textFirst = false,
}: {
  visual: React.ReactNode
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  titleClassName?: string
  titleKey?: string | null
  live?: boolean
  detail?: React.ReactNode
  dock?: React.ReactNode
  /** Puts the words above the visual on a phone, for results to read first. */
  textFirst?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-20 lg:pb-10">
      <div
        className={cn(
          "flex w-full justify-center lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:items-center",
          textFirst ? "order-2 pb-2" : "order-1"
        )}
      >
        {visual}
      </div>
      <div
        className={cn(
          "flex flex-col gap-3 lg:col-start-1 lg:row-start-2",
          textFirst ? "order-1 pt-2 pb-6" : "order-2 pt-5"
        )}
      >
        {eyebrow}
        {title ? (
          <h1
            key={titleKey ?? undefined}
            aria-live={live ? "polite" : undefined}
            className={cn("rise-in text-pretty", titleClassName)}
          >
            {title}
          </h1>
        ) : null}
        {detail}
      </div>
      {dock ? (
        <div
          className={cn(
            dockStyle,
            "order-3 mt-auto lg:static lg:col-start-1 lg:row-start-3 lg:mx-0 lg:mt-0 lg:bg-none lg:px-0 lg:pt-8 lg:pb-0"
          )}
        >
          {dock}
        </div>
      ) : null}
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
    <section className="flex flex-col gap-4">
      <h2 className="eyebrow">{label}</h2>
      {children}
    </section>
  )
}

/** A stable reading column shared by all conversational states. */
export function ConversationCanvas({
  message,
  stage = "Tranquility",
  busy = false,
  children,
  controls,
  why,
}: {
  message: React.ReactNode
  stage?: string
  busy?: boolean
  children?: React.ReactNode
  controls?: React.ReactNode
  why?: string
}) {
  return (
    <section
      className="mx-auto flex w-full max-w-xl flex-1 flex-col pt-[clamp(2rem,10svh,7rem)] pb-6"
      aria-label="Conversation"
    >
      <div
        className="mb-7 flex items-center gap-3 text-xs text-muted-foreground"
        role="status"
      >
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full bg-glow",
            busy && "motion-safe:animate-pulse"
          )}
        />
        {stage}
      </div>
      <div className="min-h-28">
        <h1 className="rise-in voice-title text-pretty" aria-live="polite">
          {message}
        </h1>
      </div>
      <div className="mt-7 flex flex-col gap-5">{children}</div>
      {why ? (
        <details className="mt-6 text-sm text-muted-foreground">
          <summary className="cursor-pointer">Why I’m asking</summary>
          <p className="mt-3 leading-relaxed">{why}</p>
        </details>
      ) : null}
      {controls ? (
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-12">
          {controls}
        </div>
      ) : null}
    </section>
  )
}
