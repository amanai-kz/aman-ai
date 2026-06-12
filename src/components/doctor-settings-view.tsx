"use client"

import { Bell, Mail, Save, Shield, Stethoscope, User } from "lucide-react"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAppCopy } from "@/lib/app-copy"

export function DoctorSettingsView({
  user,
}: {
  user: { name?: string | null; email?: string | null }
}) {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).doctorSettings

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-5xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">{copy.heading}</h2>
              <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <h3 className="font-medium">{copy.profileSection}</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={copy.fields.name}>
                    <Input defaultValue={user.name ?? ""} placeholder={copy.placeholders.name} />
                  </Field>
                  <Field label={copy.fields.email}>
                    <Input defaultValue={user.email ?? ""} placeholder={copy.placeholders.email} />
                  </Field>
                  <Field label={copy.fields.specialization}>
                    <Input
                      defaultValue={copy.placeholders.specializationValue}
                      placeholder={copy.placeholders.specialization}
                    />
                  </Field>
                  <Field label={copy.fields.license}>
                    <Input
                      defaultValue={copy.placeholders.licenseValue}
                      placeholder={copy.placeholders.license}
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <h3 className="font-medium">{copy.notificationsSection}</h3>
                </div>

                <div className="space-y-4 text-sm">
                  <PlaceholderRow icon={Mail} title={copy.rows.emailAlerts.title} description={copy.rows.emailAlerts.description} />
                  <PlaceholderRow
                    icon={Stethoscope}
                    title={copy.rows.patientReminders.title}
                    description={copy.rows.patientReminders.description}
                  />
                  <PlaceholderRow icon={Shield} title={copy.rows.security.title} description={copy.rows.security.description} />
                </div>
              </section>
            </div>

            <div className="flex justify-end">
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                {copy.save}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
