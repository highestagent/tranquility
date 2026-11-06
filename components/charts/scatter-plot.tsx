"use client"

import { useState } from "react"

const WIDTH = 320
const HEIGHT = 200
const MARGIN = { top: 12, right: 12, bottom: 34, left: 44 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

export interface ScatterPoint {
  x: number
  y: number
}

function extent(values: readonly number[]) {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = (high - low || 1) * 0.08
  return [low - pad, high + pad] as const
}

/** Least-squares line, used only as a visual guide to the points shown. */
function trendLine(points: readonly ScatterPoint[]) {
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length
  let numerator = 0
  let denominator = 0
  for (const p of points) {
    numerator += (p.x - meanX) * (p.y - meanY)
    denominator += (p.x - meanX) ** 2
  }
  if (denominator === 0) return null
  const slope = numerator / denominator
  return { slope, at: (x: number) => meanY + slope * (x - meanX) }
}

/**
 * One person's sessions, one dot each. `showTrend` should be set only when the
 * analysis found a real relationship, and the line is hidden if the raw points
 * lean the other way, as they can before practice effects are removed.
 */
export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  formatY,
  binary = false,
  showTrend = false,
  expectedSign = 0,
}: {
  points: readonly ScatterPoint[]
  xLabel: string
  yLabel: string
  formatY: (value: number) => string
  binary?: boolean
  showTrend?: boolean
  expectedSign?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const [lowY, highY] = extent(points.map((p) => p.y))
  const [lowX, highX] = binary ? ([-0.6, 1.6] as const) : extent(points.map((p) => p.x))
  const scaleX = (x: number) =>
    MARGIN.left + ((x - lowX) / (highX - lowX)) * PLOT_WIDTH
  const scaleY = (y: number) =>
    MARGIN.top + (1 - (y - lowY) / (highY - lowY)) * PLOT_HEIGHT
  // Spreads dots in the yes/no columns. Stable, so nothing shifts on re-render.
  const jitter = (index: number) => (binary ? (((index * 37) % 17) / 17 - 0.5) * 0.5 : 0)

  const line = !binary && showTrend ? trendLine(points) : null
  const showLine = line && Math.sign(line.slope) === Math.sign(expectedSign)
  const gridLines = [0, 0.5, 1].map((t) => lowY + t * (highY - lowY))
  const active = hovered === null ? null : points[hovered]

  return (
    <figure className="flex flex-col">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${yLabel} against ${xLabel}, ${points.length} sessions`}
        className="w-full"
      >
        {gridLines.map((value) => (
          <g key={value}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={scaleY(value)}
              y2={scaleY(value)}
              stroke="var(--border)"
            />
            <text
              x={MARGIN.left - 6}
              y={scaleY(value) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted-foreground)"
              className="font-mono"
            >
              {formatY(value)}
            </text>
          </g>
        ))}

        {showLine ? (
          <line
            x1={scaleX(lowX)}
            x2={scaleX(highX)}
            y1={scaleY(line.at(lowX))}
            y2={scaleY(line.at(highX))}
            stroke="var(--muted-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            className="thread-draw"
            pathLength={1}
          />
        ) : null}

        {points.map((point, index) => {
          const cx = scaleX(point.x + jitter(index))
          const cy = scaleY(point.y)
          return (
            <g key={index}>
              <circle
                cx={cx}
                cy={cy}
                r="4"
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth="2"
                className="dot-in"
                style={{ animationDelay: `${index * 25}ms` }}
              />
              <circle
                cx={cx}
                cy={cy}
                r="11"
                fill="transparent"
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
              />
            </g>
          )
        })}

        {binary ? (
          [
            { value: 0, text: "No" },
            { value: 1, text: "Yes" },
          ].map(({ value, text }) => (
            <text
              key={value}
              x={scaleX(value)}
              y={HEIGHT - 20}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {text}
            </text>
          ))
        ) : (
          <>
            <text x={MARGIN.left} y={HEIGHT - 20} fontSize="10" fill="var(--muted-foreground)" className="font-mono">
              {Math.round(lowX * 10) / 10}
            </text>
            <text x={WIDTH - MARGIN.right} y={HEIGHT - 20} textAnchor="end" fontSize="10" fill="var(--muted-foreground)" className="font-mono">
              {Math.round(highX * 10) / 10}
            </text>
          </>
        )}
        <text
          x={MARGIN.left + PLOT_WIDTH / 2}
          y={HEIGHT - 5}
          textAnchor="middle"
          fontSize="11"
          fill="var(--foreground)"
        >
          {xLabel}
        </text>

        {active && hovered !== null ? (
          <text
            x={Math.min(scaleX(active.x + jitter(hovered)) + 10, WIDTH - 70)}
            y={Math.max(scaleY(active.y) - 10, 12)}
            fontSize="11"
            fill="var(--foreground)"
            className="pointer-events-none font-mono"
            paintOrder="stroke"
            stroke="var(--card)"
            strokeWidth="4"
          >
            {`${Math.round(active.x * 10) / 10} · ${formatY(active.y)}`}
          </text>
        ) : null}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {yLabel}, by session
      </figcaption>
      <table className="sr-only">
        <caption>
          {yLabel} against {xLabel}
        </caption>
        <thead>
          <tr>
            <th>{xLabel}</th>
            <th>{yLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}>
              <td>{point.x}</td>
              <td>{formatY(point.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
