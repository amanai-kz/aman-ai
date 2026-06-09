import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bell, Save, Shield, UserCog } from "lucide-react"

export default async function AdminSettingsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  return (
    <>
      <DashboardHeader title="Настройки администратора" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Настройки доступа</h2>
              <p className="text-sm text-muted-foreground">
                Базовая страница настроек для административного раздела.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  <h3 className="font-medium">Аккаунт</h3>
                </div>
                <div className="space-y-4">
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Имя</span>
                    <Input defaultValue={session.user.name ?? ""} />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <Input defaultValue={session.user.email ?? ""} />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <h3 className="font-medium">Системные параметры</h3>
                </div>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-4">
                    Управление ролями и аудит-логами будет вынесено в отдельный модуль.
                  </div>
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-4">
                    <div className="flex items-start gap-3">
                      <Bell className="mt-0.5 h-4 w-4" />
                      <span>Оповещения о системных изменениях пока доступны как placeholder.</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end">
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
