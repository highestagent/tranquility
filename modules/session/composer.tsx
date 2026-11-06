"use client"

import { Activity, ArrowUp, Coffee, Moon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  { Icon: Coffee, text: "Does caffeine help my focus?" },
  { Icon: Moon, text: "Does sleep change my memory?" },
  { Icon: Activity, text: "How does stress affect me?" },
]

/** Asking is secondary, so suggestions appear only once you start to ask. */
export function Composer({ onAsk }: { onAsk: (text: string) => void }) {
  const [question, setQuestion] = useState("")
  const [focused, setFocused] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {focused ? (
        <ul className="rise-in -mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5">
          {SUGGESTIONS.map(({ Icon, text }) => (
            <li key={text} className="shrink-0">
              <button
                type="button"
                // Keeps focus in the field, so the chips stay until tapped.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onAsk(text)}
                className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon aria-hidden className="size-4 text-muted-foreground" />
                {text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex h-12 items-center gap-2 rounded-full border border-input bg-card pr-1 pl-5 focus-within:ring-2 focus-within:ring-ring"
        onSubmit={(event) => {
          event.preventDefault()
          const text = question.trim()
          if (!text) return
          setQuestion("")
          onAsk(text)
        }}
      >
        <input
          aria-label="Ask your own question"
          value={question}
          maxLength={500}
          autoComplete="off"
          placeholder="Ask about yourself…"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => setQuestion(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Ask"
          disabled={!question.trim()}
          className="size-10"
        >
          <ArrowUp aria-hidden />
        </Button>
      </form>
    </div>
  )
}
