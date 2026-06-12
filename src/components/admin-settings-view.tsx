"use client"

import { Bell, Save, Shield, UserCog } from "lucide-react"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAppCopy } from "@/lib/app-copy"

export function AdminSettingsView({
  user,
}: {
  user: { name?: string | null; email?: string | null }
}) {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).adminSettings

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">{copy.heading}</h2>
              <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  <h3 className="font-medium">{copy.account}</h3>
                </div>
                <div className="space-y-4">
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">{copy.fields.name}</span>
                    <Input defaultValue={user.name ?? ""} />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">{copy.fields.email}</span>
                    <Input defaultValue={user.email ?? ""} />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <h3 className="font-medium">{copy.system}</h3>
                </div>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-4">
                    {copy.notices.roles}
                  </div>
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-4">
                    <div className="flex items-start gap-3">
                      <Bell className="mt-0.5 h-4 w-4" />
                      <span>{copy.notices.alerts}</span>
                    </div>
                  </div>
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
