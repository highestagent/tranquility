import { AGENT_MODEL } from "@/modules/relay/config"

/** The full disclosure, always one tap away from any consent control. */
export function AiDisclosure() {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>
        The agent uses a cloud model (
        <code className="font-mono text-xs">{AGENT_MODEL}</code>). Through this
        app&apos;s server, it sends the model:
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>Answers and game scores the agent requests</li>
        <li>Your investigations, hypotheses, and any questions you type</li>
      </ul>
      <p>
        Raw trial data isn&apos;t sent. This app&apos;s server doesn&apos;t
        store or log the content, but the AI gateway and model provider handle
        it under their own data policies. Everything else stays in this browser.
        Games, questions, statistics, and data tools work without it.
      </p>
    </div>
  )
}
