import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { AdminUsersPage, type AdminUserRow } from "@/components/admin-users-page"

async function getUsers(): Promise<AdminUserRow[]> {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        doctor: {
          select: {
            specialization: true,
            hospital: true,
          },
        },
        patient: {
          select: {
            phone: true,
          },
        },
      },
      take: 100,
    })

    return users.map((user) => ({
      id: user.id,
      name: user.name || "",
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      details:
        user.role === "DOCTOR"
          ? user.doctor?.specialization || user.doctor?.hospital || ""
          : user.role === "PATIENT"
            ? user.patient?.phone || ""
            : "",
    }))
  } catch {
    return []
  }
}

export default async function AdminUsersRoute() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  const users = await getUsers()

  return (
    <>
      <DashboardHeader titleKey="adminUsers" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-6xl">
            <AdminUsersPage initialUsers={users} />
          </div>
        </div>
      </div>
    </>
  )
}
