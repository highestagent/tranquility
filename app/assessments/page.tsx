import { PageHeader } from "@/components/page-header"
import { GamesView } from "@/modules/assessments/games-view"
import { CheckIn } from "@/modules/session/check-in"

export default function GamesPage() {
  return (
    <>
      <PageHeader title="Games" />
      <CheckIn />
      <GamesView />
    </>
  )
}
