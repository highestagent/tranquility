"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Session" },
  { href: "/assessments", label: "Assessments" },
  { href: "/investigations", label: "Investigations" },
  { href: "/insights", label: "Insights" },
  { href: "/data", label: "Your data" },
  { href: "/settings", label: "Settings" },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="-mx-2 flex [scrollbar-width:none] gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center px-2 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              active && "font-medium text-foreground"
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
