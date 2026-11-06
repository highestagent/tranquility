/** The app's mark: still water, seen from above. */
export function PoolMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle
        cx="16"
        cy="16"
        r="14.5"
        fill="none"
        stroke="var(--primary)"
        strokeOpacity="0.3"
      />
      <circle
        cx="16"
        cy="16"
        r="9.5"
        fill="none"
        stroke="var(--primary)"
        strokeOpacity="0.6"
      />
      <circle cx="16" cy="16" r="4.5" fill="var(--primary)" />
    </svg>
  )
}
