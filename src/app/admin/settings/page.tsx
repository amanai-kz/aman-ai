import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminSettingsView } from "@/components/admin-settings-view"

export default async function AdminSettingsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return <AdminSettingsView user={session.user} />
}
