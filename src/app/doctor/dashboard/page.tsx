import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DoctorDashboardView } from "@/components/doctor-dashboard-view"

export default async function DoctorDashboardPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  return <DoctorDashboardView userName={session.user.name} />
}
