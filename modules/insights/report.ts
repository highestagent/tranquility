import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib"

import { getAssessment } from "@/modules/assessments"
import {
  GRADE_WORDS,
  listInvestigationSummaries,
  OUTCOME_LABELS,
  verdictOutcome,
} from "@/modules/investigation"
import {
  measurements,
  responses,
  sessions,
  type Discovery,
} from "@/modules/memory"
import { getQuestion } from "@/modules/questionnaire"

import { localDate } from "@/lib/utils"

import {
  byImportance,
  latestFindings,
  loadDiscoveryViews,
} from "./discovery-data"

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 56
const WIDTH = PAGE.width - MARGIN * 2
const INK = rgb(0.1, 0.12, 0.13)
const MUTED = rgb(0.42, 0.45, 0.47)
const RULE = rgb(0.85, 0.86, 0.87)

function day(at: number) {
  return new Date(at).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function factorLabel(factorId: string) {
  return getQuestion(factorId)?.label ?? factorId
}

function metricLabel(metric: { assessmentId: string; metricId: string }) {
  const assessment = getAssessment(metric.assessmentId)
  const name = assessment?.metrics.find(({ id }) => id === metric.metricId)
  return `${assessment?.shortName ?? metric.assessmentId} ${name?.label.toLowerCase() ?? metric.metricId}`
}

function describeChecks(checks: readonly Discovery[]) {
  return checks
    .map(
      (check) =>
        `${day(check.createdAt)}, ${OUTCOME_LABELS[verdictOutcome(check)]} (${GRADE_WORDS[check.grade]})`
    )
    .join("; ")
}

/** Lays text out top to bottom, starting a new page when one fills. */
class Writer {
  private page: PDFPage
  private y = PAGE.height - MARGIN
  private readonly safe = new Map<string, boolean>()

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height])
  }

  /** The standard fonts can't draw every character, so others are swapped or dropped. */
  private clean(text: string, font: PDFFont) {
    let out = ""
    for (const char of text
      .replace(/[≥]/g, ">=")
      .replace(/[≤]/g, "<=")
      .replace(/[→]/g, "->")) {
      const key = `${font.name}:${char}`
      if (!this.safe.has(key)) {
        try {
          font.widthOfTextAtSize(char, 10)
          this.safe.set(key, true)
        } catch {
          this.safe.set(key, false)
        }
      }
      out += this.safe.get(key) ? char : ""
    }
    return out
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN) return
    this.page = this.doc.addPage([PAGE.width, PAGE.height])
    this.y = PAGE.height - MARGIN
  }

  gap(size: number) {
    this.y -= size
  }

  text(
    raw: string,
    options: {
      size?: number
      bold?: boolean
      color?: typeof INK
      indent?: number
    } = {}
  ) {
    const size = options.size ?? 10
    const font = options.bold ? this.bold : this.regular
    const width = WIDTH - (options.indent ?? 0)
    const lineHeight = size * 1.4
    const words = this.clean(raw, font).split(/\s+/).filter(Boolean)
    let line = ""
    const lines: string[] = []
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
    for (const content of lines) {
      this.ensure(lineHeight)
      this.y -= lineHeight
      this.page.drawText(content, {
        x: MARGIN + (options.indent ?? 0),
        y: this.y + size * 0.3,
        size,
        font,
        color: options.color ?? INK,
      })
    }
  }

  heading(text: string) {
    this.ensure(48)
    this.gap(18)
    this.text(text.toUpperCase(), { size: 9, bold: true, color: MUTED })
    this.gap(4)
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE.width - MARGIN, y: this.y },
      thickness: 0.5,
      color: RULE,
    })
    this.gap(8)
  }

  footers() {
    const pages = this.doc.getPages()
    pages.forEach((page, index) => {
      page.drawText(
        `Tranquility research report  ·  ${index + 1} of ${pages.length}`,
        {
          x: MARGIN,
          y: MARGIN / 2,
          size: 8,
          font: this.regular,
          color: MUTED,
        }
      )
    })
  }
}

/** Everything this browser holds about the research, as a PDF. */
export async function buildReport() {
  const [checks, investigations, visits, runs, answers] = await Promise.all([
    loadDiscoveryViews(),
    listInvestigationSummaries(),
    sessions.list(),
    measurements.list(),
    responses.list(),
  ])
  const findings = latestFindings(checks).sort(byImportance)
  visits.sort((a, b) => b.startedAt - a.startedAt)

  const doc = await PDFDocument.create()
  doc.setTitle("Tranquility research report")
  doc.setCreator("Tranquility")
  const write = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold)
  )

  write.text("Tranquility research report", { size: 20, bold: true })
  write.gap(2)
  const span =
    visits.length > 0
      ? `, covering ${day(visits.at(-1)!.startedAt)} to ${day(visits[0]!.startedAt)}`
      : ""
  write.text(`Generated ${day(Date.now())}${span}.`, { color: MUTED })
  write.gap(6)
  write.text(
    `${visits.length} sessions, ${runs.filter((run) => run.valid).length} valid game results, ` +
      `${answers.filter((answer) => answer.value !== null).length} answers, ` +
      `${findings.length} findings` +
      (checks.length > findings.length ? ` from ${checks.length} checks` : "") +
      `, and ${investigations.length} investigations.`
  )
  write.gap(4)
  write.text(
    "These are patterns in your own data, not diagnoses, and an association doesn't show cause. For health concerns, see a professional.",
    { size: 9, color: MUTED }
  )

  write.heading("Findings")
  if (findings.length === 0) {
    write.text("No findings yet. They appear once there's enough evidence.", {
      color: MUTED,
    })
  }
  for (const { discovery, hypothesis, earlier } of findings) {
    write.gap(6)
    write.text(discovery.observed, { size: 11, bold: true })
    if (hypothesis) {
      write.text(`Hypothesis: ${hypothesis.statement}`, { color: MUTED })
    }
    write.text(
      `${OUTCOME_LABELS[verdictOutcome(discovery)]} (${GRADE_WORDS[discovery.grade]}), ${day(discovery.createdAt)}.`
    )
    write.text(discovery.evidence, { indent: 10 })
    write.text(discovery.reliability, { indent: 10 })
    write.text(`Still uncertain: ${discovery.uncertainty}`, { indent: 10 })
    write.text(`Next: ${discovery.nextStep}`, { indent: 10 })
    if (earlier.length > 0) {
      write.text(`Earlier checks: ${describeChecks(earlier)}.`, {
        indent: 10,
        color: MUTED,
      })
    }
  }

  write.heading("Investigations")
  if (investigations.length === 0) {
    write.text("No investigations yet.", { color: MUTED })
  }
  for (const investigation of investigations) {
    write.gap(6)
    write.text(investigation.question, { size: 11, bold: true })
    write.text(
      `${investigation.status[0]!.toUpperCase()}${investigation.status.slice(1)} · ${investigation.title}`,
      { color: MUTED }
    )
    // Progress notes are the agent's own working notes; the next step is for you.
    if (investigation.nextStep) {
      write.text(`Next: ${investigation.nextStep}`, { indent: 10 })
    }
    for (const evidence of investigation.evidence) {
      write.text(
        `${factorLabel(evidence.factorId)} with ${metricLabel(evidence.metric)}: ` +
          (evidence.have >= evidence.need
            ? `${evidence.have} paired sessions, enough to judge.`
            : `${evidence.have} of the ${evidence.need} paired sessions needed.`),
        { indent: 10, color: MUTED }
      )
    }
    for (const hypothesis of investigation.hypotheses) {
      write.text(`${hypothesis.statement} (${hypothesis.status})`, {
        indent: 10,
        color: MUTED,
      })
    }
  }

  write.heading("Recent sessions")
  if (visits.length === 0) write.text("No sessions yet.", { color: MUTED })
  for (const visit of visits.slice(0, 30)) {
    const sessionAnswers = answers.filter(
      (answer) => answer.sessionId === visit.id
    ).length
    const sessionRuns = runs.filter((run) => run.sessionId === visit.id).length
    write.text(
      `${day(visit.startedAt)}: ${sessionAnswers} answers, ${sessionRuns} game results.`
    )
  }

  write.footers()
  return doc.save()
}

/** Builds the report and hands it to the browser as a download. */
export async function downloadReport() {
  const bytes = await buildReport()
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `tranquility-report-${localDate()}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
