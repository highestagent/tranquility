import { Screen, Section } from "@/components/screen"
import { ThemeControl } from "@/components/theme-control"
import { AccountCard } from "@/modules/account/account-card"
import { AiSettings } from "@/modules/agent/ai-settings"
import { MemorySettings } from "@/modules/agent-memory/memory-settings"
import { DataView } from "@/modules/memory/data-view"
import { NotificationSettings } from "@/modules/session/notifications"

/** Who you are, then the agent, then how the app behaves, then your data. */
export default function YouPage() {
  return (
    <Screen title="You" titleClassName="voice-display">
      <AccountCard />
      <Section label="Agent">
        <div className="flex flex-col gap-3">
          <AiSettings />
          <MemorySettings />
        </div>
      </Section>
      <Section label="Preferences">
        <div className="flex flex-col gap-3">
          <ThemeControl />
          <NotificationSettings />
        </div>
      </Section>
      <DataView />
    </Screen>
  )
}
