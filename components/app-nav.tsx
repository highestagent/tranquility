"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PoolMark } from "@/components/pool-mark"
import { Sheet } from "@/components/sheet"
import { Button } from "@/components/ui/button"

const LINKS = [
  ["/", "Home"],
  ["/findings", "Findings"],
  ["/assessments", "Games"],
  ["/journal", "Journal"],
  ["/you", "You"],
] as const
export function AppNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main"
      className="flex h-[4.5rem] shrink-0 items-center justify-between"
    >
      <Link
        href="/"
        className="flex h-11 items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PoolMark className="size-5" />
        <span className="font-voice text-lg">Tranquility</span>
      </Link>
      <Sheet
        title="Explore"
        trigger={(open) => (
          <Button variant="ghost" aria-label="Open navigation" onClick={open}>
            <Menu aria-hidden className="size-4" />
            Menu
          </Button>
        )}
      >
        {(close) => (
          <div className="flex flex-col gap-2">
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={close}
                aria-current={
                  (href === "/" ? pathname === href : pathname.startsWith(href))
                    ? "page"
                    : undefined
                }
                className="rounded-lg px-3 py-3 text-lg hover:bg-muted aria-[current=page]:bg-muted"
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </Sheet>
    </nav>
  )
}
