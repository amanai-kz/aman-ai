import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { services } from "@/lib/services"
import { Badge } from "@/components/ui/badge"

export default async function AdminServicesPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <>
      <DashboardHeader title="Сервисы" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-6xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Каталог сервисов</h2>
              <p className="text-sm text-muted-foreground">
                Текущие сервисы платформы без изменения существующей интеграционной логики.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Сервис</th>
                    <th className="px-4 py-3 text-left font-medium">Команда</th>
                    <th className="px-4 py-3 text-left font-medium">Статус</th>
                    <th className="px-4 py-3 text-left font-medium">Маршрут</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-4 align-top">
                        <div>
                          <p className="font-medium">{service.title}</p>
                          <p className="mt-1 text-muted-foreground">{service.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-muted-foreground">
                        {service.team.join(", ")}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant="outline">{service.status.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{service.href}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
