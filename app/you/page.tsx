import { Screen } from "@/components/screen"
import { ThemeControl } from "@/components/theme-control"
import { AccountCard } from "@/modules/account/account-card"
import { AiSettings } from "@/modules/agent/ai-settings"
import { MemorySettings } from "@/modules/agent-memory/memory-settings"
import { DataView } from "@/modules/memory/data-view"

export default function YouPage() {
  return (
    <Screen title="You" titleClassName="voice-display">
      <div className="flex flex-col gap-3">
        <AccountCard />
        <AiSettings />
        <MemorySettings />
        <ThemeControl />
      </div>
      <DataView />
    </Screen>
  )
}
