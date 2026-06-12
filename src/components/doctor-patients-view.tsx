"use client"

import Link from "next/link"
import {
  Activity,
  Calendar,
  ChevronRight,
  Filter,
  Mail,
  Phone,
  Search,
  UserPlus,
} from "lucide-react"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAppCopy } from "@/lib/app-copy"

const patients = [
  {
    id: "1",
    name: "Алексей Ким",
    email: "alexey@example.com",
    phone: "+7 777 123 4567",
    age: 45,
    lastVisitKey: "today" as const,
    totalAnalyses: 12,
    status: "active",
    riskLevel: "low" as const,
  },
  {
    id: "2",
    name: "Мария Сергеева",
    email: "maria@example.com",
    phone: "+7 777 234 5678",
    age: 38,
    lastVisitKey: "yesterday" as const,
    totalAnalyses: 8,
    status: "active",
    riskLevel: "moderate" as const,
  },
  {
    id: "3",
    name: "Дмитрий Павлов",
    email: "dmitry@example.com",
    phone: "+7 777 345 6789",
    age: 52,
    lastVisitKey: "threeDaysAgo" as const,
    totalAnalyses: 5,
    status: "pending",
    riskLevel: "high" as const,
  },
  {
    id: "4",
    name: "Анна Иванова",
    email: "anna@example.com",
    phone: "+7 777 456 7890",
    age: 29,
    lastVisitKey: "weekAgo" as const,
    totalAnalyses: 3,
    status: "active",
    riskLevel: "low" as const,
  },
]

export function DoctorPatientsView() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).doctorPatients

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="mb-1 text-2xl font-medium tracking-tight">{copy.heading}</h2>
              <p className="text-sm text-muted-foreground">
                {patients.length} {copy.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={copy.searchPlaceholder} className="w-[200px] pl-10" />
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {copy.filter}
              </Button>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {copy.add}
              </Button>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label={copy.stats.total} value={patients.length.toString()} />
            <StatCard
              label={copy.stats.active}
              value={patients.filter((patient) => patient.status === "active").length.toString()}
            />
            <StatCard
              label={copy.stats.highRisk}
              value={patients.filter((patient) => patient.riskLevel === "high").length.toString()}
              emphasize
            />
            <StatCard label={copy.stats.newThisMonth} value="2" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {patients.map((patient, index) => (
              <Link
                key={patient.id}
                href={`/doctor/patients/${patient.id}`}
                className="group cursor-pointer rounded-2xl border border-border bg-background/60 p-5 opacity-0 backdrop-blur-sm transition-all hover:border-foreground/20 hover:shadow-lg animate-fade-up"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-lg font-medium text-background">
                      {patient.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-medium">{patient.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {patient.age} {copy.ageSuffix}
                      </p>
                    </div>
                  </div>
                  <RiskBadge
                    level={patient.riskLevel}
                    label={copy.riskLabels[patient.riskLevel]}
                  />
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{patient.phone}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {copy.lastVisit[patient.lastVisitKey]}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {patient.totalAnalyses} {copy.analysesSuffix}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4 backdrop-blur-sm">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${emphasize ? "text-red-500" : ""}`}>{value}</p>
    </div>
  )
}

function RiskBadge({ level, label }: { level: "low" | "moderate" | "high"; label: string }) {
  const styles = {
    low: "bg-green-500/10 text-green-600",
    moderate: "bg-yellow-500/10 text-yellow-600",
    high: "bg-red-500/10 text-red-600",
  }

  return <span className={`rounded-full px-2 py-1 text-[10px] ${styles[level]}`}>{label}</span>
}
