const ROTATIONS = [
  0, 90, 180, 270, 90, 0, 270, 180, 90, 180, 0, 270, 180, 90, 0, 270,
]
const TARGET = 9

export function VisualSearchPreview() {
  return (
    <div aria-hidden className="@container aspect-square h-full">
      <div className="grid h-full grid-cols-4 grid-rows-4 place-items-center gap-[3cqw] rounded-2xl bg-muted p-[7cqw] font-mono text-[13cqw] leading-none font-medium">
        {ROTATIONS.map((rotation, index) => (
          <span
            key={index}
            className={
              index === TARGET
                ? "demo-found flex size-full items-center justify-center rounded-full bg-glow text-glow-foreground"
                : "text-muted-foreground"
            }
            style={{ rotate: `${rotation}deg` }}
          >
            {index === TARGET ? "T" : "L"}
          </span>
        ))}
      </div>
    </div>
  )
}
