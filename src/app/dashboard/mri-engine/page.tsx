import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { MriAnalyzePanel } from "@/components/mri-analyze-panel"

export const dynamic = "force-dynamic"

// SCRUM-7 MRI engine surface. Resolves a Patient.id to attach the analysis to:
// the logged-in patient's own record, or (for DOCTOR/ADMIN demoing the engine)
// the first patient in the system so the page is usable from any role.
export default async function MriEnginePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  let patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!patient) {
    patient = await db.patient.findFirst({ select: { id: true } })
  }

  return <MriAnalyzePanel patientId={patient?.id ?? null} />
}
