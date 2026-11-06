import { Screen } from "@/components/screen"
import { AiSettings } from "@/modules/agent/ai-settings"
import { DataView } from "@/modules/memory/data-view"

export default function YouPage() {
  return (
    <Screen title="You" titleClassName="voice-display">
      <AiSettings />
      <DataView />
    </Screen>
  )
}
