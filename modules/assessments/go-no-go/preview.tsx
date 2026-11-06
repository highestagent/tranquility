import { Ban, Pointer } from "lucide-react"

export function GoNoGoPreview() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3">
      <div className="relative flex aspect-square items-center justify-center rounded-2xl bg-muted">
        <span className="demo-go size-14 rounded-full bg-primary" />
        <Pointer className="demo-tap absolute right-[22%] bottom-[18%] size-7 text-foreground" />
      </div>
      <div className="relative flex aspect-square items-center justify-center rounded-2xl bg-muted">
        <span
          className="demo-go size-14 border-4 border-destructive"
          style={{ animationDelay: "1.5s" }}
        />
        <Ban
          className="demo-tap absolute right-[22%] bottom-[18%] size-7 text-destructive"
          style={{ animationDelay: "1.5s" }}
        />
      </div>
    </div>
  )
}
