"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import type { ResumePoint } from "@/modules/agent-memory/resume"
import { StrengthMeter } from "@/modules/insights/strength-meter"

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(at: number) {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** When another measurement would add evidence, in everyday words. */
export function describeNextMeasurement(at: number, now: number) {
  if (at <= now) return "Another measurement would help now."
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY_MS)
  if (days === 0) return "Another measurement later today would help."
  if (days === 1) return "Another measurement tomorrow would help."
  if (days < 7) {
    const weekday = new Date(at).toLocaleDateString([], { weekday: "long" })
    return `Another measurement on ${weekday} would help.`
  }
  const date = new Date(at).toLocaleDateString([], {
    month: "long",
    day: "numeric",
  })
  return `Another measurement after ${date} would help.`
}

/** What the open investigation is checking, so any device can carry it on. */
export function ResumeNote({ resume }: { resume: ResumePoint }) {
  const { lastResult } = resume
  const [now] = useState(Date.now)
  return (
    <Card className="gap-3 rounded-3xl p-5 text-sm">
      <p className="text-xs text-muted-foreground">Where we left off</p>
      <p className="text-base font-medium text-pretty">{resume.question}</p>
      {resume.nextStep || resume.nextMeasurementAt ? (
        <p className="text-pretty text-muted-foreground">
          {[
            resume.nextStep,
            resume.nextMeasurementAt &&
              describeNextMeasurement(resume.nextMeasurementAt, now),
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      ) : null}
      {lastResult ? (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Last verified result,{" "}
            <time dateTime={new Date(lastResult.createdAt).toISOString()}>
              {new Date(lastResult.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </time>
          </p>
          <p className="text-pretty">{lastResult.observed}</p>
          <StrengthMeter grade={lastResult.grade} />
        </div>
      ) : null}
    </Card>
  )
}
