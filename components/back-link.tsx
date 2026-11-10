import { ChevronLeft } from "lucide-react"
import Link from "next/link"

/** Up one level, for pages opened from a list. */
export function BackLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-1 rounded eyebrow outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {children}
    </Link>
  )
}
