import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DoctorSettingsView } from "@/components/doctor-settings-view"

export default async function DoctorSettingsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  return <DoctorSettingsView user={session.user} />
}
