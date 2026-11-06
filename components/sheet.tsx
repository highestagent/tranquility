"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

/**
 * A bottom sheet, for detail that shouldn't compete with the screen below.
 * `children` can be a function, to close the sheet from within it.
 */
export function Sheet({
  title,
  trigger,
  children,
}: {
  title: string
  trigger: (open: () => void) => React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <>
      {trigger(() => setOpen(true))}
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="mx-auto mt-auto mb-0 w-full max-w-lg rounded-t-[2rem] bg-card text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-sm lg:mb-auto lg:rounded-[2rem]"
      >
        <div className="flex max-h-[80svh] flex-col gap-5 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow">{title}</h2>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Close"
              className="-mt-2 -mr-3"
              onClick={close}
            >
              <X aria-hidden />
            </Button>
          </div>
          {typeof children === "function" ? children(close) : children}
        </div>
      </dialog>
    </>
  )
}
