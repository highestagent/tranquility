import { Ban, Pointer } from "lucide-react"

export function GoNoGoPreview() {
  return (
    <div aria-hidden className="grid w-full grid-cols-2 gap-2">
      <div className="relative flex aspect-square items-center justify-center rounded-2xl bg-muted">
        <span className="demo-go size-1/2 rounded-full bg-primary" />
        <Pointer className="demo-tap absolute right-[14%] bottom-[12%] size-1/3 text-foreground" />
      </div>
      <div className="relative flex aspect-square items-center justify-center rounded-2xl bg-muted">
        <span
          className="demo-go size-1/2 border-[3px] border-destructive"
          style={{ animationDelay: "1.5s" }}
        />
        <Ban
          className="demo-tap absolute right-[14%] bottom-[12%] size-1/3 text-destructive"
          style={{ animationDelay: "1.5s" }}
        />
      </div>
    </div>
  )
}
