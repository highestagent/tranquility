import { useRef, useState } from "react"

interface Pending {
  count: number
  resolve: (picks: number[]) => void
}

/**
 * Lets a game's script await the user's tile presses. Presses on a selected
 * tile undo it when `allowUndo` is set, and are ignored otherwise.
 */
export function useTileCollector({ allowUndo }: { allowUndo: boolean }) {
  const [selected, setSelected] = useState<number[]>([])
  const [collecting, setCollecting] = useState(false)
  const pending = useRef<Pending | null>(null)
  const picks = useRef<number[]>([])

  function press(tile: number) {
    const current = pending.current
    if (!current) return
    if (picks.current.includes(tile)) {
      if (!allowUndo) return
      picks.current = picks.current.filter((pick) => pick !== tile)
    } else {
      picks.current = [...picks.current, tile]
    }
    setSelected(picks.current)
    if (picks.current.length === current.count) {
      pending.current = null
      setCollecting(false)
      current.resolve(picks.current)
    }
  }

  function collect(count: number, signal: AbortSignal) {
    return new Promise<number[]>((resolve, reject) => {
      picks.current = []
      setSelected([])
      setCollecting(true)
      pending.current = { count, resolve }
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Game stopped", "AbortError")),
        { once: true }
      )
    })
  }

  return {
    selected,
    collecting,
    press,
    collect,
    clear: () => setSelected([]),
  }
}
