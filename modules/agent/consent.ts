import { kv } from "@/modules/memory"

const KEY = "aiConsent"

export interface AiConsent {
  granted: boolean
  at: number
}

export async function isCloudAiEnabled() {
  return (await kv.get<AiConsent>(KEY))?.granted ?? true
}

export async function setAiConsent(granted: boolean) {
  await kv.set(KEY, { granted, at: Date.now() } satisfies AiConsent)
}
