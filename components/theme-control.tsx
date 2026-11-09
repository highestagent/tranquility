"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Card } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const OPTIONS = [
  { value: "system", label: "Match device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
]

const subscribe = () => () => undefined

export function ThemeControl() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  return (
    <Card className="flex-row items-center justify-between gap-3 rounded-3xl p-4 pl-5">
      <span className="text-sm font-medium">Appearance</span>
      <ToggleGroup
        aria-label="Appearance"
        value={mounted && theme ? [theme] : []}
        onValueChange={([value]) => {
          if (value) setTheme(value)
        }}
        className="gap-1 rounded-full bg-muted p-1"
      >
        {OPTIONS.map(({ value, label, Icon }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={label}
            title={label}
            className="size-10 rounded-full"
          >
            <Icon aria-hidden className="size-4" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Card>
  )
}
