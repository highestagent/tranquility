"use client"

import { BookOpen, Gamepad2, House, Lightbulb, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Home", icon: House },
  { href: "/findings", label: "Findings", icon: Lightbulb },
  { href: "/assessments", label: "Games", icon: Gamepad2 },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/you", label: "You", icon: UserRound },
] as const

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-20 bg-background shadow-[0_-1px_0_var(--border)]"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-1 sm:px-4">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/" && pathname === "/check-in")

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="group flex h-14 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg text-xs leading-none text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
            >
              <span className="flex h-7 w-11 items-center justify-center rounded-full group-aria-[current=page]:bg-glow/15 group-aria-[current=page]:text-glow">
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
