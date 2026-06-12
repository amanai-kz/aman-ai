import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminDashboardView } from "@/components/admin-dashboard-view"

export default async function AdminDashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  return <AdminDashboardView />
}

