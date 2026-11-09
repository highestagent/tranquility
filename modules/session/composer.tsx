"use client"

import { Input } from "@/components/ui/input"
import { Activity, ArrowUp, Coffee, Moon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  { Icon: Coffee, text: "Does caffeine help my focus?" },
  { Icon: Moon, text: "Does sleep change my memory?" },
  { Icon: Activity, text: "How does stress affect me?" },
]

/** Asking your own question: suggestions first, then your own words. */
export function Composer({ onAsk }: { onAsk: (text: string) => void }) {
  const [question, setQuestion] = useState("")

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {SUGGESTIONS.map(({ Icon, text }) => (
          <li key={text}>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onAsk(text)}
              className="-mx-3 flex h-13 w-[calc(100%+1.5rem)] items-center justify-start gap-3 rounded-2xl px-3 text-left font-voice text-lg transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              {text}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex h-13 items-center gap-2 rounded-full bg-muted pr-1.5 pl-5 ring-1 ring-border ring-inset focus-within:ring-2 focus-within:ring-ring"
        onSubmit={(event) => {
          event.preventDefault()
          const text = question.trim()
          if (!text) return
          setQuestion("")
          onAsk(text)
        }}
      >
        <Input
          aria-label="Ask your own question"
          value={question}
          maxLength={500}
          autoComplete="off"
          placeholder="Or ask your own…"
          onChange={(event) => setQuestion(event.target.value)}
          className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 dark:bg-transparent"
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
