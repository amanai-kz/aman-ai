"use client"

import { Activity, Server, Shield, Users } from "lucide-react"

import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { getAppCopy } from "@/lib/app-copy"

export function AdminDashboardView() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).adminDashboard

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="flex-1 overflow-auto p-8 md:p-12">
        <div className="max-w-6xl">
          <div className="mb-12">
            <h2 className="mb-3 text-2xl font-medium tracking-tight md:text-3xl">{copy.heading}</h2>
            <p className="text-muted-foreground">{copy.subtitle}</p>
          </div>

          <div className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <QuickStat icon={Users} label={copy.quickStats.users.label} value="0" description={copy.quickStats.users.description} />
            <QuickStat icon={Activity} label={copy.quickStats.analyses.label} value="0" description={copy.quickStats.analyses.description} />
            <QuickStat icon={Server} label={copy.quickStats.services.label} value="6" description={copy.quickStats.services.description} />
            <QuickStat icon={Shield} label={copy.quickStats.status.label} value="OK" description={copy.quickStats.status.description} />
          </div>

          <div className="mb-8">
            <h3 className="mb-6 text-lg font-medium">{copy.usersByRole}</h3>
            <div className="grid grid-cols-3 gap-4">
              <RoleCard value="0" label={copy.roleLabels.patients} />
              <RoleCard value="0" label={copy.roleLabels.doctors} />
              <RoleCard value="1" label={copy.roleLabels.admins} />
            </div>
          </div>

          <div>
            <h3 className="mb-6 text-lg font-medium">{copy.servicesStatus}</h3>
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-6 py-3 text-left text-sm font-medium">{copy.tableHeaders.service}</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">{copy.tableHeaders.status}</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">{copy.tableHeaders.url}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { name: "S1 - CT/MRI", status: "active", url: "—" },
                    { name: "S2 - IoT", status: "active", url: "—" },
                    { name: copy.serviceNames.questionnaire, status: "active", url: "—" },
                    { name: copy.serviceNames.genetics, status: "coming", url: "—" },
                    { name: copy.serviceNames.blood, status: "coming", url: "—" },
                    { name: copy.serviceNames.rehabilitation, status: "active", url: "—" },
                  ].map((service) => (
                    <tr key={service.name}>
                      <td className="px-6 py-4 text-sm">{service.name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                            service.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {service.status === "active"
                            ? copy.serviceStatuses.active
                            : copy.serviceStatuses.coming}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{service.url}</td>
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

function QuickStat({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function RoleCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border p-6 text-center">
      <p className="mb-2 text-3xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
