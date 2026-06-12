import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminStatsView } from "@/components/admin-stats-view"

export default async function AdminStatsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return <AdminStatsView />
}
