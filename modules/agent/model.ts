import { createGateway } from "ai"

import { AGENT_MODEL, RELAY_BASE_PATH } from "@/modules/relay/config"

/**
 * The only place that knows where inference happens. To add a local model,
 * return a different `LanguageModel` from here.
 */
export function createBrowserModel() {
  const gateway = createGateway({
    baseURL: `${window.location.origin}${RELAY_BASE_PATH}`,
    // The relay replaces this with the real key, which stays on the server.
    apiKey: "relay",
  })
  return gateway(AGENT_MODEL)
}
