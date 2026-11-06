import type { LucideIcon } from "lucide-react"

/** One thread from the map, on its own: this habit, linked to that ability. */
export function ThreadGlyph({
  FactorIcon,
  AbilityIcon,
  helps,
  settled,
}: {
  FactorIcon: LucideIcon
  AbilityIcon: LucideIcon
  helps: boolean | null
  /** Whether the link held up. Otherwise it's drawn as loose dots. */
  settled: boolean
}) {
  const color = !settled
    ? "var(--muted-foreground)"
    : helps === false
      ? "var(--signal-hurt)"
      : helps === true
        ? "var(--signal-help)"
        : "var(--glow)"

  return (
    <div aria-hidden className="flex items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
        <FactorIcon className="size-5" />
      </span>
      <svg viewBox="0 0 72 20" className="h-5 w-[4.5rem]">
        <line
          x1="0"
          x2="72"
          y1="10"
          y2="10"
          stroke={color}
          strokeWidth={settled ? 2.5 : 1.5}
          strokeLinecap="round"
          strokeDasharray={settled ? undefined : "1 5"}
        />
        {settled && helps !== null ? (
          <>
            <circle
              cx="36"
              cy="10"
              r="8"
              fill="var(--background)"
              stroke={color}
              strokeWidth="1.5"
            />
            <text
              x="36"
              y="14"
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="var(--foreground)"
            >
              {helps ? "+" : "−"}
            </text>
          </>
        ) : null}
      </svg>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
        <AbilityIcon className="size-5" />
      </span>
    </div>
  )
}
