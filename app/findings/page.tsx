import { Screen } from "@/components/screen"
import { FindingsView } from "@/modules/insights/findings-view"

export default function FindingsPage() {
  return (
    <Screen wide title="Findings" titleClassName="voice-display">
      <FindingsView />
    </Screen>
  )
}
