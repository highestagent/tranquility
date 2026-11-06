export type RateWindows = Map<string, { start: number; count: number }>

/** A fixed-window counter per client. Holds counts only, never request content. */
export function isOverLimit(
  windows: RateWindows,
  key: string,
  now: number,
  limit: { requests: number; windowMs: number }
) {
  const window = windows.get(key)
  if (!window || now - window.start >= limit.windowMs) {
    // Dropping expired clients keeps this map from growing without limit.
    for (const [client, entry] of windows) {
      if (now - entry.start >= limit.windowMs) windows.delete(client)
    }
    windows.set(key, { start: now, count: 1 })
    return false
  }
  window.count++
  return window.count > limit.requests
}
