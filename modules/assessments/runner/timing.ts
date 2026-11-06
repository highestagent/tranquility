import { useEffect, useEffectEvent } from "react"
import { flushSync } from "react-dom"

function abortError() {
  return new DOMException("Game stopped", "AbortError")
}

export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(abortError())
      },
      { once: true }
    )
  })
}

/**
 * Applies a state update at the start of a frame and returns its timestamp.
 * Compare this with `event.timeStamp`, which uses the same clock, to measure
 * reaction times without React's scheduling delays.
 */
export function showOnNextFrame(update: () => void, signal: AbortSignal) {
  return new Promise<number>((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const frame = requestAnimationFrame(() => {
      flushSync(update)
      resolve(performance.now())
    })
    signal.addEventListener(
      "abort",
      () => {
        cancelAnimationFrame(frame)
        reject(abortError())
      },
      { once: true }
    )
  })
}

/** Runs a game's async script once, stopping it on unmount. */
export function useGameScript(script: (signal: AbortSignal) => Promise<void>) {
  const run = useEffectEvent(script)

  useEffect(() => {
    const controller = new AbortController()
    run(controller.signal).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error
      }
    })
    return () => controller.abort()
  }, [])
}
