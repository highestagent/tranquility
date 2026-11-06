import {
  ChartScatter,
  CloudOff,
  Compass,
  Eye,
  Gamepad2,
  MessageCircleQuestion,
  Power,
  Scale,
  type LucideIcon,
} from "lucide-react"
import { useId } from "react"

export type PoolState = "resting" | "thinking" | "asleep" | "error"

export const STAGE_ORDER = [
  "understand",
  "question",
  "assess",
  "analyze",
  "reason",
  "adapt",
] as const

export type Stage = (typeof STAGE_ORDER)[number]

export const STAGE_ICONS: Record<Stage, LucideIcon> = {
  understand: Eye,
  question: MessageCircleQuestion,
  assess: Gamepad2,
  analyze: ChartScatter,
  reason: Scale,
  adapt: Compass,
}

/**
 * The agent's body. It breathes at rest, ripples while working, and shows which
 * part of the investigation cycle it's in: six marks around the rim, and the
 * current one at the centre.
 */
export function AgentPoolGroup({
  cx,
  cy,
  r,
  state,
  stage,
  visited = [],
}: {
  cx: number
  cy: number
  r: number
  state: PoolState
  stage?: Stage | null
  visited?: readonly Stage[]
}) {
  const gradientId = useId()
  const CenterIcon =
    state === "asleep"
      ? Power
      : state === "error"
        ? CloudOff
        : stage
          ? STAGE_ICONS[stage]
          : null
  const iconSize = r * 0.72

  return (
    <g data-pool={state}>
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
          <stop offset="70%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      {state === "thinking"
        ? [0, 1, 2].map((ring) => (
            <circle
              key={ring}
              className="pool-ripple"
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.5"
            />
          ))
        : null}
      <circle
        className="pool-body"
        cx={cx}
        cy={cy}
        r={r}
        fill={`url(#${gradientId})`}
        stroke="var(--primary)"
        strokeOpacity={state === "asleep" ? 0.25 : 0.55}
        opacity={state === "asleep" || state === "error" ? 0.6 : 1}
      />
      {state === "resting" && !CenterIcon ? (
        <circle cx={cx} cy={cy} r={r * 0.16} fill="var(--primary)" />
      ) : null}
      {CenterIcon ? (
        <g className="text-foreground">
          <CenterIcon
            x={cx - iconSize / 2}
            y={cy - iconSize / 2}
            width={iconSize}
            height={iconSize}
            strokeWidth={1.75}
          />
        </g>
      ) : null}
      {state === "thinking"
        ? STAGE_ORDER.map((id, index) => {
            const angle =
              (index / STAGE_ORDER.length) * 2 * Math.PI - Math.PI / 2
            const current = id === stage
            const seen = visited.includes(id)
            return (
              <circle
                key={id}
                cx={cx + Math.cos(angle) * (r + 7)}
                cy={cy + Math.sin(angle) * (r + 7)}
                r={current ? 3.5 : 2}
                fill={
                  current || seen ? "var(--primary)" : "var(--muted-foreground)"
                }
                opacity={current ? 1 : seen ? 0.7 : 0.3}
              />
            )
          })
        : null}
    </g>
  )
}

/** The pool on its own, for places too small for the map. */
export function AgentPool({
  state,
  stage,
  className,
}: {
  state: PoolState
  stage?: Stage | null
  className?: string
}) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <AgentPoolGroup cx={32} cy={32} r={22} state={state} stage={stage} />
    </svg>
  )
}
