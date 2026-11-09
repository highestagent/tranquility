"use client"

import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"

import type { DeletionCheck, DeletionResult } from "./deletion"

type Deletion =
  | { name: "deleting"; done: number; total: number }
  | { name: "done"; result: DeletionResult }
  | { name: "failed" }

function memories(count: number) {
  return `${count} ${count === 1 ? "memory" : "memories"}`
}

/** Loaded on demand, since signing pulls in the Sui libraries. */
const loadDeletion = () => import("./deletion")

/**
 * Removes saved memories from Walrus for good, where Walrus allows it. Unlike
 * forgetting, which only stops the agent recalling them, this deletes the
 * encrypted copies.
 */
export function PermanentDeletion({
  onClose,
  onDeleted,
}: {
  onClose: () => void
  onDeleted: () => void
}) {
  const load = useCallback(
    () => loadDeletion().then((module) => module.checkPermanentDeletion()),
    []
  )
  const { state, reload } = useAsync(load)
  const [deletion, setDeletion] = useState<Deletion | null>(null)

  async function remove(check: DeletionCheck) {
    setDeletion({ name: "deleting", done: 0, total: check.deletable.length })
    try {
      const { deletePermanently } = await loadDeletion()
      const result = await deletePermanently(check, (done, total) =>
        setDeletion({ name: "deleting", done, total })
      )
      setDeletion({ name: "done", result })
    } catch {
      setDeletion({ name: "failed" })
    } finally {
      onDeleted()
    }
  }

  function retry() {
    // Whatever went through is gone, so check again rather than retry blindly.
    setDeletion(null)
    void reload()
  }

  const close = (
    <Button size="lg" variant="outline" onClick={onClose}>
      Close
    </Button>
  )

  const step:
    | Deletion
    | { name: "checking" | "failed" }
    | {
        name: "ready"
        check: DeletionCheck
      } =
    deletion ??
    (state.status === "ready"
      ? { name: "ready", check: state.data }
      : state.status === "error"
        ? { name: "failed" }
        : { name: "checking" })

  switch (step.name) {
    case "checking":
      return (
        <p role="status" className="text-pretty">
          Checking what Walrus can delete…
        </p>
      )
    case "deleting":
      return (
        <p role="status" className="text-pretty text-foreground">
          Deleting… {step.done} of {step.total}
        </p>
      )
    case "failed":
      return (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-pretty text-destructive">
            That didn&apos;t finish. Try again to see what&apos;s left.
          </p>
          <div className="flex gap-2">
            <Button size="lg" variant="outline" onClick={retry}>
              Try again
            </Button>
            {close}
          </div>
        </div>
      )
    case "done": {
      const { deleted, excluded, unconfirmed } = step.result
      return (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-pretty text-foreground">
            Deleted {memories(deleted)} permanently. The agent has forgotten
            everything saved before now, on every device.
          </p>
          {excluded.length > 0 ? (
            <p className="text-pretty">
              Walrus left out {memories(excluded.length)} that had already gone,
              were about to expire, or no longer belonged to you.
            </p>
          ) : null}
          {unconfirmed > 0 ? (
            <p className="text-pretty">
              {memories(unconfirmed)} are still being deleted. Walrus will
              finish on its own.
            </p>
          ) : null}
          <div>{close}</div>
        </div>
      )
    }
    case "ready": {
      const { check } = step
      if (check.deletable.length === 0)
        return (
          <div className="flex flex-col gap-2">
            <p className="text-pretty text-foreground">
              {check.saved === 0
                ? "Nothing is saved in Walrus for this account."
                : `Walrus can't permanently delete any of the ${memories(check.saved)} saved for this account right now. Forgetting still stops the agent recalling them.`}
            </p>
            <div>{close}</div>
          </div>
        )
      return (
        <div className="flex flex-col gap-2">
          <p className="text-pretty text-foreground">
            {check.deletable.length === check.saved
              ? `All ${memories(check.saved)} saved for this account`
              : `${check.deletable.length} of the ${memories(check.saved)} saved for this account`}{" "}
            can be deleted from Walrus. This can&apos;t be undone. The agent
            will also forget everything saved so far, on every device.
          </p>
          <div className="flex gap-2">
            <Button
              size="lg"
              variant="destructive"
              onClick={() => void remove(check)}
            >
              Delete permanently
            </Button>
            <Button size="lg" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )
    }
  }
}
