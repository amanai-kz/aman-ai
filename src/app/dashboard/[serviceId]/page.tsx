import { DashboardServiceView } from "@/components/dashboard-service-view"
import { auth } from "@/lib/auth"
import { services } from "@/lib/services"
import { notFound, redirect } from "next/navigation"

export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { serviceId } = await params
  const service = services.find((s) => s.id === serviceId)

  if (!service) {
    notFound()
  }

  return <DashboardServiceView service={service} />
}

export function generateStaticParams() {
  return services.map((service) => ({
    serviceId: service.id,
  }))
}
