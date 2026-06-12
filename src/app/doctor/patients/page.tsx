import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DoctorPatientsView } from "@/components/doctor-patients-view"

export default async function DoctorPatientsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  return <DoctorPatientsView />
}

