"use client"

import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

/** A square board of tiles with arrow-key navigation, shared by span games. */
export function TileGrid({
  size,
  lit,
  selected,
  interactive,
  onPress,
}: {
  size: number
  lit: readonly number[]
  selected: readonly number[]
  interactive: boolean
  onPress: (tile: number) => void
}) {
  const [focusTile, setFocusTile] = useState(0)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: React.KeyboardEvent, tile: number) {
    const moves: Record<string, number> = {
      ArrowLeft: tile % size === 0 ? 0 : -1,
      ArrowRight: tile % size === size - 1 ? 0 : 1,
      ArrowUp: tile < size ? 0 : -size,
      ArrowDown: tile >= size * (size - 1) ? 0 : size,
    }
    const move = moves[event.key]
    if (move === undefined) return
    event.preventDefault()
    setFocusTile(tile + move)
    tiles.current[tile + move]?.focus()
  }

  return (
    <div
      role="group"
      aria-label="Tiles"
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: size * size }, (_, tile) => (
        <button
          key={tile}
          ref={(node) => {
            tiles.current[tile] = node
          }}
          type="button"
          tabIndex={tile === focusTile ? 0 : -1}
          aria-disabled={!interactive}
          aria-pressed={selected.includes(tile)}
          aria-label={`Row ${Math.floor(tile / size) + 1}, column ${(tile % size) + 1}`}
          data-lit={lit.includes(tile) || undefined}
          onClick={() => {
            setFocusTile(tile)
            if (interactive) onPress(tile)
          }}
          onKeyDown={(event) => onKeyDown(event, tile)}
          className={cn(
            "aspect-square touch-manipulation rounded-xl border border-border bg-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
            selected.includes(tile) && "border-glow bg-glow/40",
            lit.includes(tile) && "border-glow bg-glow"
          )}
        />
      ))}
    </div>
  )
}
