import { PoolMark } from "@/components/pool-mark"

/** The agent's aside, such as why it's asking. Always static. */
export function AgentNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-muted-foreground">
      <PoolMark className="mt-1 size-4 shrink-0" />
      <span className="voice-note text-pretty">{children}</span>
    </p>
  )
}
