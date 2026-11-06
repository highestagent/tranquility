"use client"

import { useCallback, useEffect, useState } from "react"

type AsyncState<T> =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: T }

/** Loads data on mount, with a `reload` for after it changes. */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" })

  const reload = useCallback(async () => {
    try {
      setState({ status: "ready", data: await load() })
    } catch {
      setState({ status: "error" })
    }
  }, [load])

  useEffect(() => {
    let active = true
    load().then(
      (data) => {
        if (active) setState({ status: "ready", data })
      },
      () => {
        if (active) setState({ status: "error" })
      }
    )
    return () => {
      active = false
    }
  }, [load])

  return { state, reload }
}
