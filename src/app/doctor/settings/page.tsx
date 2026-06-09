import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bell, Mail, Save, Shield, Stethoscope, User } from "lucide-react"

export default async function DoctorSettingsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  return (
    <>
      <DashboardHeader title="Настройки врача" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-5xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Профиль и настройки</h2>
              <p className="text-sm text-muted-foreground">
                Базовые параметры аккаунта врача без дополнительных API-зависимостей.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <h3 className="font-medium">Профиль аккаунта</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Имя">
                    <Input defaultValue={session.user.name ?? ""} placeholder="Имя врача" />
                  </Field>
                  <Field label="Email">
                    <Input defaultValue={session.user.email ?? ""} placeholder="doctor@amanai.kz" />
                  </Field>
                  <Field label="Специализация">
                    <Input defaultValue="Неврология" placeholder="Специализация" />
                  </Field>
                  <Field label="Лицензия">
                    <Input defaultValue="Не указано" placeholder="Номер лицензии" />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <h3 className="font-medium">Уведомления</h3>
                </div>

                <div className="space-y-4 text-sm">
                  <PlaceholderRow
                    icon={Mail}
                    title="Email-оповещения"
                    description="Проверка новых анализов и отчётов."
                  />
                  <PlaceholderRow
                    icon={Stethoscope}
                    title="Напоминания по пациентам"
                    description="Плановые повторные осмотры и ожидающие ревью."
                  />
                  <PlaceholderRow
                    icon={Shield}
                    title="Безопасность"
                    description="Пароль и дополнительные параметры будут подключены позже."
                  />
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function PlaceholderRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-secondary/30 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-background p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
