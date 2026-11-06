import { ASSESSMENTS } from "@/modules/assessments"
import { DOMAINS, type QuestionDomain } from "@/modules/questionnaire"

import { AgentPoolGroup, type PoolState, type Stage } from "./agent-pool"
import type { Knowledge, KnowledgeLink, KnowledgeNode } from "./knowledge"

const WIDTH = 360
const HEIGHT = 330
const CENTER = { x: 180, y: 165 }
const NODE_RADIUS = 19
const FACTOR_X = 38
const ABILITY_X = 322
const FACTOR_YS = [45, 105, 165, 225, 285]
const ABILITY_YS = [75, 135, 195, 255]

export interface MapFocus {
  domain: QuestionDomain
  assessmentId: string
}

function factorY(domain: QuestionDomain) {
  return FACTOR_YS[DOMAINS.findIndex(({ id }) => id === domain)] ?? CENTER.y
}

function abilityY(assessmentId: string) {
  return (
    ABILITY_YS[ASSESSMENTS.findIndex(({ id }) => id === assessmentId)] ??
    CENTER.y
  )
}

function controls(fromY: number, toY: number) {
  // Threads bend towards the pool: the agent is what connects the two shores.
  const pull = (y: number) => y + (CENTER.y - y) * 0.7
  return {
    x0: FACTOR_X + NODE_RADIUS,
    y0: fromY,
    x1: 150,
    y1: pull(fromY),
    x2: 210,
    y2: pull(toY),
    x3: ABILITY_X - NODE_RADIUS,
    y3: toY,
  }
}

function threadPath(domain: QuestionDomain, assessmentId: string) {
  const c = controls(factorY(domain), abilityY(assessmentId))
  return `M ${c.x0} ${c.y0} C ${c.x1} ${c.y1}, ${c.x2} ${c.y2}, ${c.x3} ${c.y3}`
}

/** A point on the thread, close enough to the shore to clear the pool. */
function markerPoint(domain: QuestionDomain, assessmentId: string, t = 0.16) {
  const c = controls(factorY(domain), abilityY(assessmentId))
  const u = 1 - t
  const at = (a: number, b: number, d: number, e: number) =>
    u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * d + t * t * t * e
  return { x: at(c.x0, c.x1, c.x2, c.x3), y: at(c.y0, c.y1, c.y2, c.y3) }
}

function threadColor(link: KnowledgeLink) {
  if (link.state === "refuted" || link.state === "inconclusive") {
    return "var(--muted-foreground)"
  }
  if (link.helps === null) return "var(--primary)"
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
        strokeWidth="2"
        strokeDasharray="4 4"
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
        strokeWidth="1.5"
        strokeDasharray="1 5"
        strokeLinecap="round"
      >
        <title>{link.title}</title>
      </path>
    )
  }
  const width =
    link.state === "supported"
      ? 1.5 + 3.5 * size
      : link.state === "signal"
        ? 1.25 + 1.5 * size
        : 1
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      opacity={link.state === "hint" ? 0.4 : link.state === "signal" ? 0.75 : 1}
      className="thread-draw"
    >
      <title>{link.title}</title>
    </path>
  )
}

function Marker({ link }: { link: KnowledgeLink }) {
  const glyph = markerGlyph(link)
  if (!glyph || link.state === "hint") return null
  const { x, y } = markerPoint(link.domain, link.assessmentId)
  return (
    <g aria-hidden className="rise-in">
      <circle
        cx={x}
        cy={y}
        r="7.5"
        fill="var(--background)"
        stroke={threadColor(link)}
        strokeWidth="1.5"
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill="var(--foreground)"
      >
        {glyph}
      </text>
    </g>
  )
}

function Node({
  x,
  y,
  node,
  label,
  Icon,
  active,
}: {
  x: number
  y: number
  node: KnowledgeNode
  label: string
  Icon: (typeof DOMAINS)[number]["Icon"]
  active: boolean
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <title>{`${label}: ${node.count} ${node.count === 1 ? "session" : "sessions"}`}</title>
      <circle
        r={NODE_RADIUS}
        fill="var(--card)"
        stroke={active ? "var(--primary)" : "var(--border)"}
        strokeWidth={active ? 2 : 1}
      />
      {node.filled > 0 ? (
        <circle
          r={NODE_RADIUS}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
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
        <Icon x={-9} y={-9} width={18} height={18} strokeWidth={1.75} />
      </g>
      <text
        y={NODE_RADIUS + 12}
        textAnchor="middle"
        fontSize="11"
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
  return `Map of habits and abilities. ${[...settled, ...testing].map(({ title }) => title).join(". ")}.`
}

/**
 * Habits on one shore, abilities on the other, the agent in the middle. It only
 * ever shows stored evidence, plus the pair the agent is working on right now.
 */
export function KnowledgeMap({
  knowledge,
  state,
  stage,
  visited,
  focus,
  scanning = false,
}: {
  knowledge: Knowledge
  state: PoolState
  stage?: Stage | null
  visited?: readonly Stage[]
  focus?: MapFocus | null
  scanning?: boolean
}) {
  const nodeFor = (nodes: readonly KnowledgeNode[], id: string) =>
    nodes.find((node) => node.id === id) ?? { id, count: 0, filled: 0 }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={summarize(knowledge)}
      className="mx-auto w-full max-w-[26rem]"
    >
      {scanning
        ? DOMAINS.flatMap(({ id: domain }, row) =>
            ASSESSMENTS.map(({ id: assessmentId }, column) => (
              <path
                key={`${domain}-${assessmentId}`}
                d={threadPath(domain, assessmentId)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1"
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
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeDasharray="4 4"
          strokeLinecap="round"
          className="thread-march thread-focus"
        />
      ) : null}

      <AgentPoolGroup
        cx={CENTER.x}
        cy={CENTER.y}
        r={40}
        state={state}
        stage={stage}
        visited={visited}
      />

      {knowledge.links.map((link) => (
        <Marker key={`${link.domain}-${link.assessmentId}`} link={link} />
      ))}

      {DOMAINS.map(({ id, label, Icon }) => (
        <Node
          key={id}
          x={FACTOR_X}
          y={factorY(id)}
          node={nodeFor(knowledge.factors, id)}
          label={label}
          Icon={Icon}
          active={focus?.domain === id}
        />
      ))}
      {ASSESSMENTS.map(({ id, shortName, Icon }) => (
        <Node
          key={id}
          x={ABILITY_X}
          y={abilityY(id)}
          node={nodeFor(knowledge.abilities, id)}
          label={shortName}
          Icon={Icon}
          active={focus?.assessmentId === id}
        />
      ))}
    </svg>
  )
}

/** Keys only for what's on the map right now, with a mark as well as a colour. */
export function MapLegend({ links }: { links: readonly KnowledgeLink[] }) {
  const has = (test: (link: KnowledgeLink) => boolean) => links.some(test)
  const settled = (link: KnowledgeLink) =>
    link.state === "supported" || link.state === "signal"
  const items = [
    has((l) => settled(l) && l.helps === true) && {
      glyph: "+",
      color: "var(--signal-help)",
      text: "Helps",
    },
    has((l) => settled(l) && l.helps === false) && {
      glyph: "−",
      color: "var(--signal-hurt)",
      text: "Hurts",
    },
    has((l) => l.state === "testing") && {
      glyph: "",
      color: "var(--primary)",
      text: "Testing",
    },
    has((l) => l.state === "inconclusive") && {
      glyph: "?",
      color: "var(--muted-foreground)",
      text: "Unclear",
    },
    has((l) => l.state === "refuted") && {
      glyph: "×",
      color: "var(--muted-foreground)",
      text: "No link",
    },
  ].filter((item) => item !== false)
  if (items.length === 0) return null

  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ glyph, color, text }) => (
        <li key={text} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="flex size-4 items-center justify-center rounded-full border-[1.5px] text-[0.65rem] font-semibold text-foreground"
            style={{
              borderColor: color,
              borderStyle: glyph ? "solid" : "dashed",
            }}
          >
            {glyph}
          </span>
          {text}
        </li>
      ))}
    </ul>
  )
}
