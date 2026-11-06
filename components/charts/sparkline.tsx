const WIDTH = 240
const HEIGHT = 56
const PADDING = 8

/**
 * A run history. `invert` flips lower-is-better metrics, so up always means
 * better wherever the user sees one of these.
 */
export function Sparkline({
  values,
  invert = false,
  label,
  format,
  className,
}: {
  values: readonly number[]
  invert?: boolean
  label: string
  format: (value: number) => string
  className?: string
}) {
  if (values.length < 2) return null
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  const x = (index: number) =>
    PADDING + (index / (values.length - 1)) * (WIDTH - PADDING * 2)
  const y = (value: number) => {
    const ratio = (value - low) / span
    return PADDING + (invert ? ratio : 1 - ratio) * (HEIGHT - PADDING * 2)
  }
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ")
  const last = values.length - 1

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${label}: ${values.length} runs, latest ${format(values[last]!)}`}
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(last)}
        cy={y(values[last]!)}
        r="4"
        fill="var(--primary)"
        stroke="var(--card)"
        strokeWidth="2"
      />
      {values.map((value, index) => (
        <circle key={index} cx={x(index)} cy={y(value)} r="10" fill="transparent">
          <title>{format(value)}</title>
        </circle>
      ))}
    </svg>
  )
}
