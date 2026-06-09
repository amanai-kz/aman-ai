import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { DoctorWorklistView } from "@/components/doctor-worklist-view"
import {
  DoctorWorklistCase,
  getMockDoctorWorklistCases,
  mapRiskToPriority,
  sortDoctorWorklistCases,
} from "@/lib/doctor-worklist"

async function getDoctorWorklistCases(userId: string): Promise<{ cases: DoctorWorklistCase[]; source: "db" | "mock" }> {
  try {
    const doctor = await db.doctor.findUnique({
      where: { userId },
      select: {
        id: true,
        patients: {
          select: {
            patientId: true,
          },
        },
      },
    })

    const patientIds = doctor?.patients.map((entry) => entry.patientId) ?? []
    const where = patientIds.length > 0 ? { patientId: { in: patientIds } } : undefined

    const analyses = await db.analysis.findMany({
      where,
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: {
        patient: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (analyses.length === 0) {
      return { cases: getMockDoctorWorklistCases("ru"), source: "mock" }
    }

    const cases = analyses.map<DoctorWorklistCase>((analysis) => ({
      id: analysis.id,
      patientId: analysis.patientId,
      patientName: analysis.patient.user.name || "",
      studyType: analysis.serviceType,
      priority: mapRiskToPriority(analysis.riskLevel),
      status: analysis.status,
      aiSummary: analysis.findings.length > 0 ? analysis.findings.join(", ") : "",
      updatedAt: analysis.updatedAt.toISOString(),
    }))

    return { cases: sortDoctorWorklistCases(cases), source: "db" }
  } catch {
    return { cases: getMockDoctorWorklistCases("ru"), source: "mock" }
  }
}

export default async function DoctorWorklistPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  const { cases, source } = await getDoctorWorklistCases(session.user.id)

  return (
    <>
      <DashboardHeader titleKey="doctorWorklist" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <DoctorWorklistView cases={cases} source={source} />
        </div>
      </div>
    </>
  )
}
