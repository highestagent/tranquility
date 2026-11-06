import { ArrowRight } from "lucide-react"

const PATTERN = [1, 3, 8]

function MiniGrid({
  animation,
  stagger,
}: {
  animation: string
  stagger: number
}) {
  return (
    <div className="grid flex-1 grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, tile) => {
        const order = PATTERN.indexOf(tile)
        return (
          <span
            key={tile}
            className="relative aspect-square rounded-md bg-muted"
          >
            {order >= 0 ? (
              <span
                className={`demo-on ${animation}`}
                style={{ animationDelay: `${order * stagger}s` }}
              />
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

export function VisuospatialGridPreview() {
  return (
    <div aria-hidden className="flex w-full items-center gap-2">
      <MiniGrid animation="demo-flash" stagger={0} />
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      <MiniGrid animation="demo-recall" stagger={0.15} />
    </div>
  )
}
