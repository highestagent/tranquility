import { kv } from "@/modules/memory"

const KEY = "aiConsent"

export interface AiConsent {
  granted: boolean
  at: number
}

export async function getAiConsent() {
  return (await kv.get<AiConsent>(KEY)) ?? null
}

export async function setAiConsent(granted: boolean) {
  await kv.set(KEY, { granted, at: Date.now() } satisfies AiConsent)
}
