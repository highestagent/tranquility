const ORDER = [4, 0, 8, 5]

/** Tiles light in order, then the same order is shown being pressed. */
export function SequenceRecallPreview() {
  return (
    <div
      aria-hidden
      className="mx-auto grid aspect-square h-full max-h-full max-w-full grid-cols-3 gap-1.5"
    >
      {Array.from({ length: 9 }, (_, tile) => {
        const order = ORDER.indexOf(tile)
        return (
          <span
            key={tile}
            className="relative flex aspect-square items-center justify-center rounded-lg bg-muted"
          >
            {order >= 0 ? (
              <span
                className="demo-on demo-seq flex items-center justify-center font-mono text-sm font-medium text-primary-foreground"
                style={{ animationDelay: `${order * 0.7}s` }}
              >
                {order + 1}
              </span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
