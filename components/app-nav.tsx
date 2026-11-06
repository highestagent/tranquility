"use client"

import { Fingerprint, Gamepad2, Telescope } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { PoolMark } from "@/components/pool-mark"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/findings", label: "Findings", Icon: Telescope },
  { href: "/assessments", label: "Games", Icon: Gamepad2 },
  { href: "/you", label: "You", Icon: Fingerprint },
]

const focusRing =
  "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="-mx-2 flex h-14 shrink-0 items-center justify-between"
    >
      <Link
        href="/"
        aria-label="Tranquility home"
        aria-current={pathname === "/" ? "page" : undefined}
        className={cn("flex size-11 items-center justify-center", focusRing)}
      >
        <PoolMark className="size-7" />
      </Link>
      <div className="flex items-center gap-1">
        {LINKS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                focusRing,
                active && "text-foreground"
              )}
            >
              <Icon aria-hidden className="size-5" />
              {active ? (
                <span
                  aria-hidden
                  className="absolute bottom-1 size-1 rounded-full bg-primary"
                />
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
