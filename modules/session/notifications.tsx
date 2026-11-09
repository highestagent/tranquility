"use client"
import { Bell } from "lucide-react"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { kv } from "@/modules/memory"
import { getAgentRest } from "./wake"
export function SessionNotifications() {
  useEffect(() => {
    async function check() {
      try {
        if (
          !("Notification" in window) ||
          Notification.permission !== "granted" ||
          !(await kv.get("sessionNotifications"))
        )
          return
        const rest = await getAgentRest()
        if (
          !rest?.nextAt ||
          rest.nextAt > Date.now() ||
          (await kv.get("notifiedSessionAt")) === rest.nextAt
        )
          return
        new Notification("Tranquility", {
          body: "Another research session may be useful. Open Tranquility when you’re ready.",
          tag: "tranquility-session",
        })
        await kv.set("notifiedSessionAt", rest.nextAt)
      } catch {
        /* Notification availability never blocks a session. */
      }
    }
    void check()
    const timer = setInterval(() => void check(), 60000)
    return () => clearInterval(timer)
  }, [])
  return null
}
export function NotificationSettings() {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState("")
  useEffect(() => {
    kv.get<boolean>("sessionNotifications").then(
      (v) => setEnabled(v ?? false),
      () => setStatus("Could not read notification preferences.")
    )
  }, [])
  async function toggle(next: boolean) {
    try {
      if (
        next &&
        (!("Notification" in window) ||
          (await Notification.requestPermission()) !== "granted")
      ) {
        setStatus("Browser notifications are unavailable or not permitted.")
        return
      }
      await kv.set("sessionNotifications", next)
      setEnabled(next)
      setStatus("")
    } catch {
      setStatus("Could not save this preference. Please retry.")
    }
  }
  return (
    <Card className="gap-3 rounded-3xl p-4 pl-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bell aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="session-reminders" className="text-sm font-medium">
            Session reminders
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            When the next session is due
          </p>
        </div>
        <Switch
          checked={enabled}
          aria-labelledby="session-reminders"
          onCheckedChange={(checked) => void toggle(checked)}
        />
      </div>
      {status ? (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}
    </Card>
  )
}
