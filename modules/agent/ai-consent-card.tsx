import { AGENT_MODEL } from "@/modules/relay/config"

/** The full disclosure, always one tap away from any consent control. */
export function AiDisclosure() {
  return (
    <div className="flex flex-col gap-3 text-sm text-pretty text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">Your account.</span> Begin
        signs you in with Google through Privy, which holds your account.
      </p>
      <p>
        <span className="font-medium text-foreground">The agent.</span> It uses
        a cloud model (<code className="font-mono text-xs">{AGENT_MODEL}</code>
        ). Through this app&apos;s server, it sends the model the answers and
        game scores it requests, your investigations and hypotheses, and any
        questions you type. Raw trial data isn&apos;t sent.
      </p>
      <p>
        <span className="font-medium text-foreground">Its memory.</span> Its
        findings and progress notes are saved with Walrus Memory, so it can pick
        up where it left off. They&apos;re encrypted on Walrus, but the Walrus
        Memory service reads them while storing and searching them, and this
        app&apos;s server can access them. Your answers and game results
        aren&apos;t included.
      </p>
      <p>
        This app&apos;s server doesn&apos;t store or log any of this. The AI
        gateway, model provider, and Walrus Memory handle it under their own
        policies. Everything else stays in this browser. Games, questions,
        statistics, and your data tools all work without any of it.
      </p>
    </div>
  )
}
