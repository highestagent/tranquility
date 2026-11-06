const ROTATIONS = [
  0, 90, 180, 270, 90, 0, 270, 180, 90, 180, 0, 270, 180, 90, 0, 270,
]
const TARGET = 9

export function VisualSearchPreview() {
  return (
    <div
      aria-hidden
      className="mx-auto grid w-full max-w-60 grid-cols-4 gap-2 rounded-2xl bg-muted p-4"
    >
      {ROTATIONS.map((rotation, index) => (
        <span
          key={index}
          className={
            index === TARGET
              ? "demo-found flex aspect-square items-center justify-center rounded-full bg-primary font-mono text-xl font-medium text-primary-foreground"
              : "flex aspect-square items-center justify-center font-mono text-xl font-medium text-muted-foreground"
          }
          style={{ rotate: `${rotation}deg` }}
        >
          {index === TARGET ? "T" : "L"}
        </span>
      ))}
    </div>
  )
}
