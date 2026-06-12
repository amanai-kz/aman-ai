"use client"

import Link from "next/link"
import {
  AlertCircle,
  Activity,
  ArrowUpRight,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { getDoctorDashboardPageData } from "@/lib/doctor-dashboard"

export function DoctorDashboardView({ userName }: { userName?: string | null }) {
  const { locale } = useAppLocale()
  const copy = getDoctorDashboardPageData(locale)

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm lg:col-span-2">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">{copy.greeting}</p>
                  <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
                    {userName || copy.doctorFallback}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {copy.pendingReviews.items.length} {copy.pendingSummary}
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-3xl font-semibold">{new Date().getDate()}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(
                      locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU",
                      { weekday: "long", month: "long" }
                    ).format(new Date())}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="sm" className="rounded-full gap-2" asChild>
                  <Link href="/doctor/reviews">
                    <ClipboardCheck className="h-4 w-4" />
                    {copy.actions.reviews}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-full gap-2" asChild>
                  <Link href="/doctor/patients">
                    <Users className="h-4 w-4" />
                    {copy.actions.patients}
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full gap-2" asChild>
                  <Link href="/doctor/reports">
                    <FileText className="h-4 w-4" />
                    {copy.actions.reports}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{copy.accuracy.title}</span>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mb-4 flex items-end gap-2">
                <span className="text-5xl font-semibold tracking-tight">94</span>
                <span className="mb-1 text-2xl text-muted-foreground">%</span>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">{copy.accuracy.description}</p>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-[94%] rounded-full bg-foreground" />
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={Users} label={copy.stats.patients.label} value="0" description={copy.stats.patients.description} trend={12} />
            <StatCard icon={ClipboardCheck} label={copy.stats.reviews.label} value={copy.pendingReviews.items.length.toString()} description={copy.stats.reviews.description} trend={null} highlight />
            <StatCard icon={FileText} label={copy.stats.reports.label} value="0" description={copy.stats.reports.description} trend={5} />
            <StatCard icon={Calendar} label={copy.stats.visits.label} value="0" description={copy.stats.visits.description} trend={null} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-sm lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-medium">{copy.pendingReviews.heading}</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/doctor/reviews">
                    {copy.pendingReviews.all}
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              {copy.pendingReviews.items.length > 0 ? (
                <div className="divide-y divide-border">
                  {copy.pendingReviews.items.map((review, index) => (
                    <div
                      key={review.id}
                      className="group cursor-pointer p-4 opacity-0 transition-colors hover:bg-secondary/30 animate-fade-up"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${review.priority === "high" ? "bg-red-500" : review.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
                            {review.type === "CT_MRI" ? <Brain className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{review.patient}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.type === "CT_MRI"
                                ? copy.pendingReviews.reviewTypes.ctMri
                                : review.type === "IOT"
                                  ? copy.pendingReviews.reviewTypes.iot
                                  : copy.pendingReviews.reviewTypes.questionnaire}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{review.date}</p>
                          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />
                  <p className="text-sm text-muted-foreground">{copy.pendingReviews.empty}</p>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <h3 className="text-sm font-medium">{copy.recentPatients.heading}</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/doctor/patients">
                    {copy.recentPatients.all}
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              <div className="divide-y divide-border">
                {copy.recentPatients.items.map((patient, index) => (
                  <div
                    key={patient.id}
                    className="group cursor-pointer p-4 opacity-0 transition-colors hover:bg-secondary/30 animate-fade-up"
                    style={{ animationDelay: `${(index + 3) * 100}ms`, animationFillMode: "forwards" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                        {patient.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.lastVisit}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {patient.analyses} {copy.recentPatients.analysesSuffix}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border p-4">
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <UserPlus className="h-4 w-4" />
                  {copy.recentPatients.addPatient}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  trend,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string
  description: string
  trend: number | null
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-sm ${
        highlight ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-background/60"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${highlight ? "bg-orange-500/20" : "bg-secondary"}`}>
          <Icon className={`h-4 w-4 ${highlight ? "text-orange-500" : ""}`} />
        </div>
        {trend !== null && (
          <span className="flex items-center gap-0.5 text-xs text-green-600">
            <ArrowUpRight className="h-3 w-3" />
            {trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{description}</p>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
