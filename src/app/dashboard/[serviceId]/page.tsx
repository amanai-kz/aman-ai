import { DashboardServiceView } from "@/components/dashboard-service-view"
import { MriAnalyzePanel } from "@/components/mri-analyze-panel"
import { MriClassificationPanel } from "@/components/mri-classification-panel"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { services } from "@/lib/services"
import { notFound, redirect } from "next/navigation"

export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { serviceId } = await params
  const service = services.find((s) => s.id === serviceId)

  if (!service) {
    notFound()
  }

  const segmentationMode =
    serviceId === "mri-seg-static"
      ? "static"
      : serviceId === "mri-seg-adaptive"
        ? "adaptive"
        : null

  const isClassification =
    serviceId === "mri-classification"

  if (!segmentationMode && !isClassification) {
    return <DashboardServiceView service={service} />
  }

  let patientId: string | null = null
  if (session.user.role === "PATIENT") {
    patientId =
      (
        await db.patient.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      )?.id ?? null
  } else if (session.user.role === "DOCTOR") {
    patientId =
      (
        await db.doctor.findUnique({
          where: { userId: session.user.id },
          select: {
            patients: {
              orderBy: { assignedAt: "asc" },
              take: 1,
              select: { patientId: true },
            },
          },
        })
      )?.patients[0]?.patientId ?? null
  } else if (session.user.role === "ADMIN") {
    patientId = (await db.patient.findFirst({ select: { id: true } }))?.id ?? null
  }

  if (isClassification) {
    return (
      <DashboardServiceView service={service}>
        <MriClassificationPanel patientId={patientId} />
      </DashboardServiceView>
    )
  }

  // Explicitly eliminate the nullable branch so TypeScript knows
  // segmentationMode is "static" | "adaptive" below.
  if (!segmentationMode) {
    return <DashboardServiceView service={service} />
  }

  return (
    <DashboardServiceView service={service}>
      <MriAnalyzePanel patientId={patientId} mode={segmentationMode} />
    </DashboardServiceView>
  )
}

export function generateStaticParams() {
  return services.map((service) => ({
    serviceId: service.id,
  }))
}
