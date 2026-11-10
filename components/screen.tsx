import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { AgentOrb } from "@/modules/insights/agent-orb"
import { cn } from "@/lib/utils"

const dockStyle =
  "sticky bottom-[var(--bottom-nav-space,0px)] z-10 -mx-5 flex flex-col gap-2 bg-background px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"

/**
 * Every screen has the same anatomy, so the eye always knows where to look:
 *
 *   eyebrow  why this is here (quiet)
 *   title    the one thing to read
 *   body     the one thing to look at
 *   dock     the one thing to do, in thumb reach
 *
 * Spacing rhythm: a 20px gutter (from the layout), 24px between regions, and
 * 12px within a group. Screens share the same reading width.
 */
export function Screen({
  eyebrow,
  title,
  titleClassName = "voice-title",
  children,
  dock,
}: {
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  titleClassName?: string
  children?: React.ReactNode
  dock?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      {eyebrow || title ? (
        <header className="flex min-w-0 flex-col gap-3 pt-2 pb-7">
          {eyebrow}
          {title ? (
            <h1 className={cn("rise-in text-balance", titleClassName)}>
              {title}
            </h1>
          ) : null}
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
  whyLabel = "Why I’m asking",
}: {
  message: React.ReactNode
  stage?: string
  busy?: boolean
  children?: React.ReactNode
  controls?: React.ReactNode
  why?: string
  whyLabel?: string
}) {
  return (
    <section
      className="mx-auto flex w-full max-w-lg flex-1 flex-col pt-[clamp(2rem,10svh,7rem)] pb-6"
      aria-label="Conversation"
    >
      <div
        className="mb-7 flex items-center gap-3 text-xs text-muted-foreground"
        role="status"
      >
        <AgentOrb size={20} state={busy ? "thinking" : "resting"} />
        {stage}
      </div>
      <div className="min-h-28">
        <h1 className="rise-in voice-title text-pretty" aria-live="polite">
          {message}
        </h1>
      </div>
      <div className="mt-7 flex flex-col gap-5">{children}</div>
      {why ? (
        <Collapsible className="mt-6 text-sm text-muted-foreground">
          <CollapsibleTrigger className="cursor-pointer rounded text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {whyLabel}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-3 leading-relaxed">{why}</p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {controls ? (
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-12">
          {controls}
        </div>
      ) : null}
    </section>
  )
}
