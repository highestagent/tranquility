"use client"

import { X, type LucideIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"

/** A bottom sheet, for detail that shouldn't compete with the screen below. */
export function Sheet({
  label,
  Icon,
  title,
  children,
}: {
  label: string
  Icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={label}
        title={label}
        onClick={() => dialog.current?.showModal()}
      >
        <Icon aria-hidden className="text-muted-foreground" />
      </Button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
        className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-3xl bg-card text-foreground backdrop:bg-black/50"
      >
        <div className="flex max-h-[75svh] flex-col gap-4 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="voice-title">{title}</h2>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Close"
              className="-mr-2"
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden />
            </Button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  )
}
