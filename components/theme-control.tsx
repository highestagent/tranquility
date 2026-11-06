"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "system", label: "Match device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
]

const subscribe = () => () => undefined

export function ThemeControl() {
  const { theme, setTheme } = useTheme()
  // The stored theme is unknown until the page runs in the browser.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4"
    >
      <span className="font-medium">Appearance</span>
      <span className="flex gap-1 rounded-full bg-muted p-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = mounted && theme === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              onClick={() => setTheme(value)}
              className={cn(
                "flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "bg-card text-foreground shadow-sm"
              )}
            >
              <Icon aria-hidden className="size-4" />
            </button>
          )
        })}
      </span>
    </div>
  )
}
