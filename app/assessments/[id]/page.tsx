import { notFound } from "next/navigation"

import { ASSESSMENTS, getAssessment } from "@/modules/assessments"
import { AssessmentRunner } from "@/modules/assessments/runner/assessment-runner"

export function generateStaticParams() {
  return ASSESSMENTS.map(({ id }) => ({ id }))
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!getAssessment(id)) notFound()
  return <AssessmentRunner assessmentId={id} />
}
