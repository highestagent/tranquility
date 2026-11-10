export { cn } from "cn"

/** Today as YYYY-MM-DD in the person's own time zone, for file names. */
export function localDate(at = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}
