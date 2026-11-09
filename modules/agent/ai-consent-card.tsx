import { AGENT_MODEL } from "@/modules/relay/config"

/** The full disclosure, always one tap away from any consent control. */
export function AiDisclosure() {
  return (
    <div className="flex flex-col gap-3 text-sm text-pretty text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">Your account.</span> You
        can sign in with Google through Privy from You. Cross-device memory uses
        a wallet created for you. You never need to fund or manage it.
      </p>
      <p>
        <span className="font-medium text-foreground">The agent.</span> It uses
        a cloud model (<code className="font-mono text-xs">{AGENT_MODEL}</code>
        ). Through this app&apos;s server, it sends the model the answers and
        game scores it requests, your investigations and hypotheses, and any
        questions you type. Raw trial data isn&apos;t sent.
      </p>
      <p>
        <span className="font-medium text-foreground">Its memory.</span> If you
        enable cross-device memory in You, its findings and progress notes are
        saved to your own Walrus Memory account, so it can pick up where it left
        off on any device. They&apos;re encrypted on Walrus, but the Walrus
        Memory service reads them while storing and searching them. Your answers
        and game results aren&apos;t included. Your account&apos;s existence and
        wallet address are public on the Sui blockchain, though not linked to
        your email there.
      </p>
      <p>
        Agent and memory requests pass through this app&apos;s server, which
        doesn&apos;t store or log them and holds no key to your memories. The AI
        gateway, model provider, and Walrus Memory handle them under their own
        policies. Everything else stays in this browser. Games, questions,
        statistics, and your data tools all work without any of it.
      </p>
    </div>
  )
}
