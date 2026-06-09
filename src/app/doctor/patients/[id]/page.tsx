import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { DoctorPatientDetailView } from "@/components/doctor-patient-detail-view"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"

const mockPatients = [
  {
    id: "1",
    name: "Алексей Ким",
    email: "alexey@example.com",
    phone: "+7 777 123 4567",
    noteKey: "localMock" as const,
  },
  {
    id: "2",
    name: "Мария Сергеева",
    email: "maria@example.com",
    phone: "+7 777 234 5678",
    noteKey: "assignments" as const,
  },
  {
    id: "3",
    name: "Дмитрий Павлов",
    email: "dmitry@example.com",
    phone: "+7 777 345 6789",
    noteKey: "history" as const,
  },
  {
    id: "4",
    name: "Анна Иванова",
    email: "anna@example.com",
    phone: "+7 777 456 7890",
    noteKey: "safePlaceholder" as const,
  },
]

async function getPatientDetail(id: string) {
  try {
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        analyses: {
          select: {
            id: true,
          },
        },
      },
    })

    if (patient) {
      return {
        id: patient.id,
        name: patient.user.name || "",
        email: patient.user.email || "",
        phone: patient.phone || patient.phoneNumber || "",
        analysesCount: patient.analyses.length,
        source: "db" as const,
      }
    }
  } catch {
    // Fall back to the local placeholder data below.
  }

  const mockPatient = mockPatients.find((patient) => patient.id === id)
  if (!mockPatient) return null

  return {
    ...mockPatient,
    analysesCount: 0,
    source: "mock" as const,
  }
}

export default async function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  const { id } = await params
  const patient = await getPatientDetail(id)

  if (!patient) {
    redirect("/doctor/patients")
  }

  return (
    <>
      <DashboardHeader titleKey="doctorPatientDetail" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <DoctorPatientDetailView patient={patient} />
        </div>
      </div>
    </>
  )
}
