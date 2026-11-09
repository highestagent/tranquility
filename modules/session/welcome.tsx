"use client"
import { ConversationCanvas } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { AiDisclosure } from "@/modules/agent/ai-consent-card"

export function Welcome({
  useGoogle,
  signingIn,
  signInFailed,
  onBegin,
  onWithoutAi,
}: {
  useGoogle: boolean
  signingIn: boolean
  signInFailed: boolean
  onBegin: () => void
  onWithoutAi: () => void
}) {
  return (
    <ConversationCanvas
      stage="Getting to know you"
      message="Let’s get some basic information about you."
    >
      <p className="leading-relaxed text-muted-foreground">
        We’ll start with sleep, mood, stress, and energy. Before we talk, may I
        use cloud AI to guide our conversation?
      </p>
      <div className="rounded-xl border p-5 text-sm leading-relaxed">
        <p>
          The model may receive your contextual answers, requested game scores,
          investigations, and anything you ask. Raw game trials stay on this
          device.
        </p>
        <p className="mt-3 text-muted-foreground">
          Your research is stored locally. Cross-device memory is off by default
          and can be enabled separately in You.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer">
            How your information is handled
          </summary>
          <div className="mt-4">
            <AiDisclosure />
          </div>
        </details>
      </div>
      {signInFailed ? (
        <p role="alert">Sign-in didn’t finish. Please try again.</p>
      ) : null}
      <Button size="cta" disabled={signingIn} onClick={onBegin}>
        {signingIn
          ? "Opening sign-in…"
          : useGoogle
            ? "Allow cloud AI and sign in"
            : "Allow cloud AI"}
      </Button>
      <Button variant="ghost" onClick={onWithoutAi}>
        Not now
      </Button>
    </ConversationCanvas>
  )
}
