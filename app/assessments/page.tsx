import { Screen } from "@/components/screen"
import { GamesView } from "@/modules/assessments/games-view"

export default function GamesPage() {
  return (
    <Screen wide title="Games" titleClassName="voice-display">
      <GamesView />
    </Screen>
  )
}
