"use client"
import Link from "next/link"
import { ConversationCanvas } from "@/components/screen"
export function RestingWithoutAi() {
  return (
    <ConversationCanvas stage="Paused" message="I’m here when you’re ready.">
      <p className="text-muted-foreground">
        The conversation is paused. Your progress is saved. You can still
        explore your research or take a measurement.
      </p>
      <div className="flex gap-6 text-sm underline underline-offset-4">
        <Link href="/assessments">Games</Link>
        <Link href="/journal">Journal</Link>
        <Link href="/you">Cloud AI settings</Link>
      </div>
    </ConversationCanvas>
  )
}
