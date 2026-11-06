/** The signed-in account, set by the account module. */
interface MemoryAccount {
  userId: string
  getToken: () => Promise<string | null>
}

let account: MemoryAccount | null = null

export function setMemoryAccount(next: MemoryAccount | null) {
  account = next
}

export function getMemoryUserId() {
  return account?.userId ?? null
}

/** The server has no Walrus Memory credentials, so retrying won't help. */
export class MemoryNotConfiguredError extends Error {}

/** No one is signed in. Nothing to do until someone is. */
export class NotSignedInError extends Error {}

async function call<T>(
  action: string,
  body: object,
  timeoutMs = 15_000
): Promise<T> {
  const token = await account?.getToken()
  if (!token) throw new NotSignedInError()

  const response = await fetch(`/api/memory/${action}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.status === 503) throw new MemoryNotConfiguredError()
  if (!response.ok) throw new Error(`Memory request failed: ${response.status}`)
  return (await response.json()) as T
}

export interface RecalledMemory {
  text: string
  at: string | null
}

export const memoryApi = {
  remember: (texts: string[]) =>
    call<{ jobIds: string[] }>("remember", {
      items: texts.map((text) => ({ text })),
    }),
  status: (jobIds: string[]) =>
    call<{ jobs: { jobId: string; status: string }[] }>("status", { jobIds }),
  recall: (query: string, limit: number, timeoutMs: number) =>
    call<{ memories: RecalledMemory[] }>("recall", { query, limit }, timeoutMs),
  forget: () => call<{ ok: true }>("forget", {}),
  info: () => call<{ configured: boolean }>("info", {}),
}

export type MemoryApi = typeof memoryApi
