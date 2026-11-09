"use client"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
  async function toggle() {
    try {
      if (
        !enabled &&
        (!("Notification" in window) ||
          (await Notification.requestPermission()) !== "granted")
      ) {
        setStatus("Browser notifications are unavailable or not permitted.")
        return
      }
      await kv.set("sessionNotifications", !enabled)
      setEnabled(!enabled)
      setStatus("")
    } catch {
      setStatus("Could not save this preference. Please retry.")
    }
  }
  return (
    <Card className="items-start gap-3 rounded-xl p-5">
      <h2 className="text-sm font-medium">Session invitations</h2>
      <p className="text-sm text-muted-foreground">
        Optional browser notifications while Tranquility is open. Closed-browser
        delivery is not supported; your next invitation will be here when you
        return.
      </p>
      <Button variant="outline" onClick={() => void toggle()}>
        {enabled ? "Turn off notifications" : "Enable browser notifications"}
      </Button>
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
    </Card>
  )
}
