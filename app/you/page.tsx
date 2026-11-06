import { Screen } from "@/components/screen"
import { ThemeControl } from "@/components/theme-control"
import { AiSettings } from "@/modules/agent/ai-settings"
import { DataView } from "@/modules/memory/data-view"

export default function YouPage() {
  return (
    <Screen title="You" titleClassName="voice-display">
      <div className="flex flex-col gap-3">
        <AiSettings />
        <ThemeControl />
      </div>
      <DataView />
    </Screen>
  )
}
