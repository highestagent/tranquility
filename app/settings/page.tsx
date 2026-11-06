import { PageHeader } from "@/components/page-header"
import { AiSettings } from "@/modules/agent/ai-settings"

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Choose how AI is used." />
      <AiSettings />
    </>
  )
}
