export type HomeView = "loading" | "error" | "welcome" | "asleep" | "agent"

/**
 * Which screen Home shows. The agent needs consent and, where accounts work, a
 * signed-in account. If Privy is unreachable, the app stays usable on this
 * device, because no account is required for its core functionality.
 */
export function homeView(input: {
  consent: "loading" | "error" | "ask" | "declined" | "granted"
  accountReady: boolean
  accountAvailable: boolean
  authenticated: boolean
}): HomeView {
  const { consent, accountReady, accountAvailable, authenticated } = input
  if (consent === "error") return "error"
  if (consent === "loading" || !accountReady) return "loading"
  if (consent === "ask") return "welcome"
  if (consent === "declined") return "asleep"
  return authenticated || !accountAvailable ? "agent" : "welcome"
}
