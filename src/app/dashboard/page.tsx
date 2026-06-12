import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PatientDashboardHomeView } from "@/components/patient-dashboard-home-view"

export default async function DashboardPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  if (session.user.role === "DOCTOR") {
    redirect("/doctor/dashboard")
  }
  if (session.user.role === "ADMIN") {
    redirect("/admin/dashboard")
  }

  return <PatientDashboardHomeView userName={session.user.name} />
}
