import { DashboardServiceView } from "@/components/dashboard-service-view"
import { auth } from "@/lib/auth"
import { neuroguardService } from "@/lib/neuroguard-service"
import { redirect } from "next/navigation"

export default async function NeuroGuardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <DashboardServiceView service={neuroguardService} />
}
