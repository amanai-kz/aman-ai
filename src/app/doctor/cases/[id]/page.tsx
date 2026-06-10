import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { DoctorCaseDetailView } from "@/components/doctor-case-detail-view"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import {
  buildDoctorCaseDetail,
  buildMockDoctorCaseDetail,
} from "@/lib/doctor-case-detail"

async function getCaseDetail(id: string) {
  try {
    const analysis = await db.analysis.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (analysis) {
      return buildDoctorCaseDetail({
        id: analysis.id,
        patientName: analysis.patient.user.name || "",
        patientEmail: analysis.patient.user.email || "",
        studyType: analysis.serviceType,
        status: analysis.status,
        riskLevel: analysis.riskLevel,
        findings: analysis.findings,
        confidence: analysis.confidence,
        updatedAt: analysis.updatedAt,
      })
    }
  } catch {
    // Fallback to mock data below when local DB is not ready.
  }

  return buildMockDoctorCaseDetail(id)
}

export default async function DoctorCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  const { id } = await params
  const detail = await getCaseDetail(id)

  if (!detail) {
    redirect("/doctor/worklist")
  }

  return (
    <>
      <DashboardHeader titleKey="doctorCaseDetail" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <DoctorCaseDetailView detail={detail} />
        </div>
      </div>
    </>
  )
}
