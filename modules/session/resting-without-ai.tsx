"use client"
import Link from "next/link"
import { ConversationCanvas } from "@/components/screen"
import { Button } from "@/components/ui/button"
export function RestingWithoutAi({ onWake }: { onWake: () => void }) {
  return (
    <ConversationCanvas
      stage="Paused"
      message="I’m here when you’re ready."
      controls={<Button onClick={onWake}>Review cloud AI permission</Button>}
    >
      <p className="text-muted-foreground">
        The conversation is paused. Your progress stays on this device. You can
        still explore your research or take a measurement.
      </p>
      <div className="flex gap-6 text-sm underline underline-offset-4">
        <Link href="/assessments">Games</Link>
        <Link href="/journal">Journal</Link>
      </div>
    </ConversationCanvas>
  )
}
