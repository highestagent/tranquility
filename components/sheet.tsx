"use client"

import { useState, type ReactElement } from "react"

import {
  Sheet as SheetRoot,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/** The app's reading width and safe-area spacing for bottom sheets. */
export function Sheet({
  title,
  trigger,
  children,
}: {
  title: string
  trigger: ReactElement
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
}) {
  const [open, setOpen] = useState(false)

  return (
    <SheetRoot open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[80svh] max-w-lg gap-5 overflow-y-auto rounded-t-[2rem] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] motion-reduce:transition-none"
      >
        <SheetTitle className="pr-8 eyebrow">{title}</SheetTitle>
        {typeof children === "function"
          ? children(() => setOpen(false))
          : children}
      </SheetContent>
    </SheetRoot>
  )
}
