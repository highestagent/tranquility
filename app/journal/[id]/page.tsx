import { JournalEntryView } from "@/modules/journal/journal-view"

/** Sessions live in this browser, so the page loads one by its ID there. */
export default async function JournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <JournalEntryView sessionId={id} />
}
