import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { ASSESSMENTS } from "@/modules/assessments"
import { CheckIn } from "@/modules/session/check-in"

export default function AssessmentsPage() {
  return (
    <>
      <PageHeader title="Games" />
      <ul className="flex flex-col gap-2">
        {ASSESSMENTS.map((assessment) => (
          <li key={assessment.id}>
            <Link
              href={`/assessments/${assessment.id}`}
              className="flex flex-col gap-1 border border-border p-4 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium">{assessment.name}</span>
              <span className="text-sm text-muted-foreground">
                {assessment.measures}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <CheckIn />
    </>
  )
}
