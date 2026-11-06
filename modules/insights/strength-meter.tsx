import { cn } from "@/lib/utils"
import type { EvidenceGrade } from "@/modules/memory"

const LEVELS: Record<EvidenceGrade, { filled: number; label: string }> = {
  insufficient: { filled: 0, label: "Too little data" },
  weak: { filled: 1, label: "Weak evidence" },
  moderate: { filled: 2, label: "Moderate evidence" },
  strong: { filled: 3, label: "Strong evidence" },
  contradictory: { filled: 0, label: "Contradictory" },
}

export function StrengthMeter({ grade }: { grade: EvidenceGrade }) {
  const { filled, label } = LEVELS[grade]
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden className="flex gap-1">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1 w-5 rounded-full bg-foreground/15",
              level <= filled && "bg-glow",
              grade === "contradictory" && "bg-muted-foreground/40"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
