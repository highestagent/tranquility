const ROTATIONS = [
  0, 90, 180, 270, 90, 0, 270, 180, 90, 180, 0, 270, 180, 90, 0, 270,
]
const TARGET = 9

export function VisualSearchPreview() {
  return (
    <div
      aria-hidden
      className="mx-auto grid aspect-square h-full max-h-full max-w-full grid-cols-4 gap-1 rounded-2xl bg-muted p-3"
    >
      {ROTATIONS.map((rotation, index) => (
        <span
          key={index}
          className={
            index === TARGET
              ? "demo-found flex aspect-square items-center justify-center rounded-full bg-primary font-mono text-base font-medium text-primary-foreground"
              : "flex aspect-square items-center justify-center font-mono text-base font-medium text-muted-foreground"
          }
          style={{ rotate: `${rotation}deg` }}
        >
          {index === TARGET ? "T" : "L"}
        </span>
      ))}
    </div>
  )
}
