"use client"

import { Activity, Shield, UserRound, Users } from "lucide-react"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { getAppCopy } from "@/lib/app-copy"

export function AdminStatsView() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).adminStats
  const cards = [
    { key: "users", value: "100", icon: Users },
    { key: "admins", value: "1", icon: Shield },
    { key: "doctors", value: "—", icon: UserRound },
    { key: "activity", value: "OK", icon: Activity },
  ] as const

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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map(({ key, value, icon: Icon }) => (
                <div key={key} className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-xl bg-secondary p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {copy.cards[key].label}
                    </span>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.cards[key].description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
