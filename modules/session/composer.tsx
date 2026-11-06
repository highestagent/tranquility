"use client"

import { Activity, ArrowUp, Coffee, Moon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  { Icon: Coffee, text: "Does caffeine help my focus?" },
  { Icon: Moon, text: "Does sleep change my memory?" },
  { Icon: Activity, text: "How does stress affect me?" },
]

export function Composer({ onAsk }: { onAsk: (text: string) => void }) {
  const [question, setQuestion] = useState("")

  return (
    <div className="flex flex-col gap-3">
      <ul className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4">
        {SUGGESTIONS.map(({ Icon, text }) => (
          <li key={text} className="shrink-0">
            <button
              type="button"
              onClick={() => onAsk(text)}
              className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon aria-hidden className="size-4 text-muted-foreground" />
              {text}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-2 rounded-full border border-input bg-card p-1.5 pl-5 focus-within:ring-2 focus-within:ring-ring"
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
          onChange={(event) => setQuestion(event.target.value)}
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
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
