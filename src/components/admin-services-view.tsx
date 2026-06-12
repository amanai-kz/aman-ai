"use client"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { getAppCopy } from "@/lib/app-copy"
import { getLocalizedServices } from "@/lib/services"

export function AdminServicesView() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).adminServices
  const services = getLocalizedServices(locale)

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />
        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-6xl space-y-6">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">{copy.heading}</h2>
              <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{copy.tableHeaders.service}</th>
                    <th className="px-4 py-3 text-left font-medium">{copy.tableHeaders.team}</th>
                    <th className="px-4 py-3 text-left font-medium">{copy.tableHeaders.status}</th>
                    <th className="px-4 py-3 text-left font-medium">{copy.tableHeaders.route}</th>
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
                        <Badge variant="outline">{copy.statuses[service.status]}</Badge>
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
