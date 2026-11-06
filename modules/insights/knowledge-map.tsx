import { ASSESSMENTS } from "@/modules/assessments"
import { DOMAINS, type QuestionDomain } from "@/modules/questionnaire"

import { AgentOrb, type OrbState } from "./agent-orb"
import type { Knowledge, KnowledgeLink, KnowledgeNode } from "./knowledge"
import { STAGES, type Stage } from "./stages"

const SIZE = 360
const CENTER = SIZE / 2
const RING = 146
const NODE_RADIUS = 18

/** Habits around the left of the orb, abilities around the right. */
const FACTOR_ANGLES = [122, 151, 180, 209, 238]
const ABILITY_ANGLES = [-48, -16, 16, 48]

export interface MapFocus {
  domain: QuestionDomain
  assessmentId: string
}

interface Point {
  x: number
  y: number
}

function onRing(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  return {
    x: CENTER + RING * Math.cos(radians),
    y: CENTER + RING * Math.sin(radians),
  }
}

function factorPoint(domain: QuestionDomain) {
  const index = DOMAINS.findIndex(({ id }) => id === domain)
  return onRing(FACTOR_ANGLES[index] ?? 180)
}

function abilityPoint(assessmentId: string) {
  const index = ASSESSMENTS.findIndex(({ id }) => id === assessmentId)
  return onRing(ABILITY_ANGLES[index] ?? 0)
}

function controls(domain: QuestionDomain, assessmentId: string) {
  const from = factorPoint(domain)
  const to = abilityPoint(assessmentId)
  // Threads bend through the orb: the agent is what connects the two sides.
  const pull = (point: Point) => ({
    x: point.x + (CENTER - point.x) * 0.72,
    y: point.y + (CENTER - point.y) * 0.72,
  })
  return { from, c1: pull(from), c2: pull(to), to }
}

function threadPath(domain: QuestionDomain, assessmentId: string) {
  const { from, c1, c2, to } = controls(domain, assessmentId)
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`
}

/** A point along the thread, spaced so marks sharing a node don't collide. */
function markerPoint(domain: QuestionDomain, assessmentId: string, t: number) {
  const { from, c1, c2, to } = controls(domain, assessmentId)
  const u = 1 - t
  const at = (a: number, b: number, c: number, d: number) =>
    u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
  return {
    x: at(from.x, c1.x, c2.x, to.x),
    y: at(from.y, c1.y, c2.y, to.y),
  }
}

function threadColor(link: KnowledgeLink) {
  if (link.state === "refuted" || link.state === "inconclusive") {
    return "var(--muted-foreground)"
  }
  if (link.helps === null) return "var(--glow)"
  return link.helps ? "var(--signal-help)" : "var(--signal-hurt)"
}

function markerGlyph(link: KnowledgeLink) {
  if (link.state === "refuted") return "×"
  if (link.state === "inconclusive") return "?"
  if (link.state === "testing" || link.helps === null) return null
  return link.helps ? "+" : "−"
}

function Thread({ link }: { link: KnowledgeLink }) {
  const d = threadPath(link.domain, link.assessmentId)
  const size = Math.abs(link.effect ?? 0)
  const color = threadColor(link)

  if (link.state === "testing") {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="3 5"
        strokeLinecap="round"
        className="thread-march"
      >
        <title>{link.title}</title>
      </path>
    )
  }
  if (link.state === "refuted" || link.state === "inconclusive") {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeDasharray="1 5"
        strokeLinecap="round"
        opacity="0.7"
      >
        <title>{link.title}</title>
      </path>
    )
  }
  const width =
    link.state === "supported"
      ? 1.25 + 2.75 * size
      : link.state === "signal"
        ? 1 + 1.25 * size
        : 0.75
  const settled = link.state === "supported"
  return (
    <g>
      {settled ? (
        // A soft glow beneath the line, so a finding reads as lit.
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width * 3.5}
          strokeLinecap="round"
          opacity="0.22"
          style={{ filter: "blur(5px)" }}
        />
      ) : null}
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={
          link.state === "hint" ? 0.32 : link.state === "signal" ? 0.7 : 1
        }
        className="thread-draw"
      >
        <title>{link.title}</title>
      </path>
    </g>
  )
}

function Marker({ link, order }: { link: KnowledgeLink; order: number }) {
  const glyph = markerGlyph(link)
  if (!glyph) return null
  const { x, y } = markerPoint(
    link.domain,
    link.assessmentId,
    0.14 + order * 0.1
  )
  return (
    <g aria-hidden className="rise-in">
      <circle
        cx={x}
        cy={y}
        r="7"
        fill="var(--background)"
        stroke={threadColor(link)}
        strokeWidth="1"
      />
      <text
        x={x}
        y={y + 3.25}
        textAnchor="middle"
        fontSize="10"
        fontWeight="500"
        fill="var(--foreground)"
      >
        {glyph}
      </text>
    </g>
  )
}

function Node({
  point,
  node,
  label,
  Icon,
  active,
}: {
  point: Point
  node: KnowledgeNode
  label: string
  Icon: (typeof DOMAINS)[number]["Icon"]
  active: boolean
}) {
  return (
    <g transform={`translate(${point.x} ${point.y})`}>
      <title>{`${label}: ${node.count} ${node.count === 1 ? "session" : "sessions"}`}</title>
      <circle
        r={NODE_RADIUS}
        style={{
          fill: "color-mix(in oklch, var(--card) 86%, transparent)",
          stroke: active
            ? "var(--glow)"
            : "color-mix(in oklch, var(--foreground) 12%, transparent)",
          filter: active ? "drop-shadow(0 0 8px var(--glow))" : undefined,
        }}
        strokeWidth={active ? 1.25 : 0.75}
      />
      {node.filled > 0 ? (
        <circle
          r={NODE_RADIUS}
          fill="none"
          stroke="var(--glow)"
          strokeWidth="1.25"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${node.filled * 100} 100`}
          transform="rotate(-90)"
        />
      ) : null}
      <g
        className={
          active || node.filled > 0
            ? "text-foreground"
            : "text-muted-foreground"
        }
      >
        <Icon x={-8} y={-8} width={16} height={16} strokeWidth={1.6} />
      </g>
      <text
        y={NODE_RADIUS + 13}
        textAnchor="middle"
        fontSize="10"
        letterSpacing="0.02em"
        fill="var(--muted-foreground)"
      >
        {label}
      </text>
    </g>
  )
}

function summarize(knowledge: Knowledge) {
  const settled = knowledge.links.filter(
    ({ state }) => state === "supported" || state === "signal"
  )
  const testing = knowledge.links.filter(({ state }) => state === "testing")
  if (settled.length === 0 && testing.length === 0) {
    return "Map of habits and abilities. No connections found yet."
  }
  return `Map of habits and abilities. ${[...settled, ...testing]
    .map(({ title }) => title)
    .join(". ")}.`
}

/**
 * Habits around one side, abilities around the other, and the agent between
 * them. It only ever shows stored evidence, plus the pair being worked on now.
 * Threads pass behind the orb and nodes sit in front of it.
 */
export function KnowledgeMap({
  knowledge,
  state,
  stage,
  focus,
  scanning = false,
}: {
  knowledge: Knowledge
  state: OrbState
  stage?: Stage | null
  focus?: MapFocus | null
  scanning?: boolean
}) {
  const nodeFor = (nodes: readonly KnowledgeNode[], id: string) =>
    nodes.find((node) => node.id === id) ?? { id, count: 0, filled: 0 }
  const StageIcon = stage ? STAGES[stage].Icon : null

  return (
    <div
      role="img"
      aria-label={summarize(knowledge)}
      className="relative aspect-square w-full"
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full"
      >
        {scanning
          ? DOMAINS.flatMap(({ id: domain }, row) =>
              ASSESSMENTS.map(({ id: assessmentId }, column) => (
                <path
                  key={`${domain}-${assessmentId}`}
                  d={threadPath(domain, assessmentId)}
                  fill="none"
                  stroke="var(--glow)"
                  strokeWidth="0.75"
                  className="thread-scan"
                  style={{ animationDelay: `${(row * 4 + column) * 90}ms` }}
                />
              ))
            )
          : null}
        {knowledge.links.map((link) => (
          <Thread key={`${link.domain}-${link.assessmentId}`} link={link} />
        ))}
        {focus ? (
          <path
            d={threadPath(focus.domain, focus.assessmentId)}
            pathLength={1}
            fill="none"
            stroke="var(--glow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="thread-pulse"
          />
        ) : null}
      </svg>

      <div className="absolute inset-0">
        <AgentOrb state={state} />
      </div>

      {StageIcon ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <StageIcon
            key={stage}
            aria-hidden
            className="rise-in size-[9%] text-white drop-shadow-[0_1px_6px_rgb(0_0_0_/_0.45)]"
            strokeWidth={1.5}
          />
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full"
      >
        {knowledge.links
          .filter((link) => link.state !== "hint" && markerGlyph(link))
          .map((link, index, marked) => (
            <Marker
              key={`${link.domain}-${link.assessmentId}`}
              link={link}
              order={
                marked
                  .slice(0, index)
                  .filter(({ domain }) => domain === link.domain).length
              }
            />
          ))}
        {DOMAINS.map(({ id, label, Icon }) => (
          <Node
            key={id}
            point={factorPoint(id)}
            node={nodeFor(knowledge.factors, id)}
            label={label}
            Icon={Icon}
            active={focus?.domain === id}
          />
        ))}
        {ASSESSMENTS.map(({ id, shortName, Icon }) => (
          <Node
            key={id}
            point={abilityPoint(id)}
            node={nodeFor(knowledge.abilities, id)}
            label={shortName}
            Icon={Icon}
            active={focus?.assessmentId === id}
          />
        ))}
      </svg>
    </div>
  )
}

/** Keys only for what's on the map, with a mark as well as a colour. */
export function MapLegend({ knowledge }: { knowledge: Knowledge }) {
  const { links } = knowledge
  const has = (test: (link: KnowledgeLink) => boolean) => links.some(test)
  const settled = (link: KnowledgeLink) =>
    link.state === "supported" || link.state === "signal"
  const items = [
    has((l) => settled(l) && l.helps === true) && {
      glyph: "+",
      color: "var(--signal-help)",
      style: "solid",
      text: "Helps",
    },
    has((l) => settled(l) && l.helps === false) && {
      glyph: "−",
      color: "var(--signal-hurt)",
      style: "solid",
      text: "Hurts",
    },
    has((l) => l.state === "testing") && {
      glyph: "",
      color: "var(--glow)",
      style: "dashed",
      text: "Testing",
    },
    has((l) => l.state === "inconclusive") && {
      glyph: "?",
      color: "var(--muted-foreground)",
      style: "solid",
      text: "Unclear",
    },
    has((l) => l.state === "refuted") && {
      glyph: "×",
      color: "var(--muted-foreground)",
      style: "solid",
      text: "No link",
    },
  ].filter((item) => item !== false)
  if (items.length === 0) return null

  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
      {items.map(({ glyph, color, style, text }) => (
        <li key={text} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="flex size-3.5 items-center justify-center rounded-full border text-[0.6rem] font-medium text-foreground"
            style={{ borderColor: color, borderStyle: style }}
          >
            {glyph}
          </span>
          {text}
        </li>
      ))}
    </ul>
  )
}
