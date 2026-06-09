import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { Activity, Shield, UserRound, Users } from "lucide-react"

const cards = [
  { label: "Пользователи", value: "100", description: "лимит текущей выборки", icon: Users },
  { label: "Администраторы", value: "1", description: "роль с полным доступом", icon: Shield },
  { label: "Врачи", value: "—", description: "заполняется из пользовательского раздела", icon: UserRound },
  { label: "Активность", value: "OK", description: "базовый статус раздела", icon: Activity },
]

export default async function AdminStatsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <>
      <DashboardHeader title="Статистика" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-5xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Обзор статистики</h2>
              <p className="text-sm text-muted-foreground">
                Временный безопасный экран вместо 404 для административной навигации.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map(({ icon: Icon, label, value, description }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-xl bg-secondary p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
