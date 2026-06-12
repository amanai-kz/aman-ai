import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DoctorReviewsView } from "@/components/doctor-reviews-view"

export default async function DoctorReviewsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  return <DoctorReviewsView />
}

