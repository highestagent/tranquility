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

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="flex h-[4.5rem] shrink-0 items-center justify-between"
    >
      <Link
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className="flex h-11 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PoolMark className="size-6" />
        <span className="font-voice text-lg tracking-[-0.01em]">
          Tranquility
        </span>
      </Link>
      <div className="flex items-center gap-0.5 rounded-full p-1 surface">
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
                "flex h-9 min-w-10 items-center justify-center gap-2 rounded-full px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:px-4",
                active && "bg-foreground/10 text-foreground"
              )}
            >
              <Icon aria-hidden className="size-[1.0625rem]" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
