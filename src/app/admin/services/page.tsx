import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminServicesView } from "@/components/admin-services-view"

export default async function AdminServicesPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return <AdminServicesView />
}
