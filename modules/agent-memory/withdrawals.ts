import { kv } from "@/modules/memory"

import type { RestoredHandoff } from "./distill"
import { HANDOFFS_KEY, WITHDRAWALS_KEY, type WithdrawalRecord } from "./records"

/** The key-value store, as open in someone else's transaction. */
interface KvStore {
  get(key: string): Promise<{ key: string; value: unknown } | undefined>
  put(row: { key: string; value: unknown }): Promise<unknown>
}

export async function getLocalWithdrawals() {
  return (await kv.get<WithdrawalRecord[]>(WITHDRAWALS_KEY)) ?? []
}

/**
 * Marks findings as no longer standing, in the caller's transaction so a
 * correction and its withdrawals land together. Sync tells other devices.
 */
export async function recordWithdrawals(
  store: KvStore,
  findingIds: readonly string[],
  at: number,
  reason: string
) {
  if (findingIds.length === 0) return
  const ids = new Set(findingIds)
  const existing =
    ((await store.get(WITHDRAWALS_KEY))?.value as
      WithdrawalRecord[] | undefined) ?? []
  await store.put({
    key: WITHDRAWALS_KEY,
    value: [
      ...existing.filter(({ id }) => !ids.has(id)),
      ...findingIds.map((id): WithdrawalRecord => ({
        kind: "withdrawal",
        id,
        at,
        reason,
      })),
    ],
  })
  // A result carried over from another device mustn't stand in for it either.
  const handoffs = (await store.get(HANDOFFS_KEY))?.value as
    Record<string, RestoredHandoff> | undefined
  if (!handoffs) return
  for (const handoff of Object.values(handoffs)) {
    if (handoff.latestFinding && ids.has(handoff.latestFinding.id)) {
      delete handoff.latestFinding
    }
  }
  await store.put({ key: HANDOFFS_KEY, value: handoffs })
}
