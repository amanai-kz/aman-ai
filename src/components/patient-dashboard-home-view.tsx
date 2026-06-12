"use client"

import Link from "next/link"
import {
  Activity,
  ArrowUpRight,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Heart,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"

import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import { MoodCheck } from "@/components/mood-check"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { ServiceCard } from "@/components/service-card"
import { getAppCopy } from "@/lib/app-copy"
import { getLocalizedServices } from "@/lib/services"

export function PatientDashboardHomeView({ userName }: { userName?: string | null }) {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).patientDashboard
  const services = getLocalizedServices(locale)

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <MoodCheck />

          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm lg:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">{copy.welcomeLabel}</p>
                  <h2 className="mb-4 text-2xl font-medium tracking-tight md:text-3xl">
                    {userName || "User"}
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">{copy.welcomeSubtitle}</p>
                </div>
                <div className="hidden items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1.5 text-xs text-orange-500 sm:flex">
                  <Flame className="h-3 w-3" />
                  <span>{copy.streak}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="sm" className="rounded-full gap-2" asChild>
                  <Link href="/dashboard/questionnaire">
                    <Sparkles className="h-4 w-4" />
                    {copy.actions.questionnaire}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-full gap-2" asChild>
                  <Link href="/dashboard/ct-mri">
                    <Brain className="h-4 w-4" />
                    {copy.actions.uploadScan}
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full gap-2" asChild>
                  <Link href="/dashboard/iot">
                    <Activity className="h-4 w-4" />
                    {copy.actions.iot}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{copy.score.title}</span>
                <Brain className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mb-4 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-tight text-emerald-500">78</span>
                <span className="mb-2 text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="mb-4 flex gap-4 text-xs text-muted-foreground">
                <span>{copy.score.sleep}: 85%</span>
                <span>{copy.score.hrv}: 72%</span>
                <span>{copy.score.stress}: 32%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-[78%] rounded-full bg-emerald-500 transition-all duration-500" />
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <QuickStat icon={Activity} label={copy.stats.analyses.label} value="12" description={copy.stats.analyses.description} trend="up" />
            <QuickStat icon={FileText} label={copy.stats.questionnaires.label} value="5" description={copy.stats.questionnaires.description} trend="up" />
            <QuickStat icon={TrendingUp} label={copy.stats.stress.label} value="32%" description={copy.stats.stress.description} trend="down" />
            <QuickStat icon={Calendar} label={copy.stats.nextVisit.label} value="15" description={copy.stats.nextVisit.description} trend={null} />
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-medium">{copy.services.heading}</h3>
                <span className="text-xs text-muted-foreground">
                  {services.length} {copy.services.availableSuffix}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {services.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    title={service.title}
                    description={service.description}
                    iconName={service.iconName}
                    href={service.href}
                    index={index}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="text-sm font-medium">{copy.recommendations.heading}</h3>
                </div>
                <div className="space-y-3">
                  <RecommendationItem icon={Heart} title={copy.recommendations.items.heart.title} description={copy.recommendations.items.heart.description} priority="high" />
                  <RecommendationItem icon={Brain} title={copy.recommendations.items.cognition.title} description={copy.recommendations.items.cognition.description} priority="medium" />
                  <RecommendationItem icon={Zap} title={copy.recommendations.items.stress.title} description={copy.recommendations.items.stress.description} priority="low" />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    <h3 className="text-sm font-medium">{copy.tasks.heading}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">2/3</span>
                </div>
                <div className="space-y-3">
                  <TaskItem title={copy.tasks.items.profile} completed />
                  <TaskItem title={copy.tasks.items.questionnaire} completed />
                  <TaskItem title={copy.tasks.items.iot} completed={false} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <h3 className="text-sm font-medium">{copy.recentActivity.heading}</h3>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  {copy.recentActivity.allHistory}
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-3">
                <ActivityItem {...copy.recentActivity.items.mri} type="success" />
                <ActivityItem {...copy.recentActivity.items.pss} type="info" />
                <ActivityItem {...copy.recentActivity.items.iot} type="default" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <h3 className="text-sm font-medium">{copy.healthInsights.heading}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{copy.healthInsights.period}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <MiniMetric label="HRV" value="62" unit="ms" />
                <MiniMetric label="SpO2" value="98" unit="%" />
                <MiniMetric label={copy.healthInsights.stressLabel} value="32" unit="%" />
              </div>
              <div className="mt-4 flex h-24 items-end gap-1 rounded-xl bg-secondary/30 p-3">
                {[40, 55, 45, 70, 65, 80, 75, 85, 78, 82, 88, 78].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-foreground/20 transition-colors hover:bg-foreground/40"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
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
  trend,
}: {
  icon: React.ElementType
  label: string
  value: string
  description: string
  trend: "up" | "down" | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
            <ArrowUpRight className={`h-3 w-3 ${trend === "down" ? "rotate-90" : ""}`} />
            12%
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

function RecommendationItem({
  icon: Icon,
  title,
  description,
  priority,
}: {
  icon: React.ElementType
  title: string
  description: string
  priority: "high" | "medium" | "low"
}) {
  const priorityColors = {
    high: "bg-foreground text-background",
    medium: "bg-secondary",
    low: "bg-secondary/50",
  }

  return (
    <div className="group flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors hover:bg-secondary/50">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${priorityColors[priority]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}

function TaskItem({ title, completed }: { title: string; completed: boolean }) {
  return (
    <div className="flex items-center gap-3 p-2">
      <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${completed ? "border-foreground bg-foreground" : "border-border"}`}>
        {completed && <CheckCircle2 className="h-3 w-3 text-background" />}
      </div>
      <span className={`text-sm ${completed ? "line-through text-muted-foreground" : ""}`}>{title}</span>
    </div>
  )
}

function MiniMetric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-secondary/30 p-3 text-center">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">
        {value}
        <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

function ActivityItem({
  title,
  description,
  time,
  type,
}: {
  title: string
  description: string
  time: string
  type: "success" | "info" | "default"
}) {
  const colors = {
    success: "bg-emerald-500",
    info: "bg-blue-500",
    default: "bg-muted-foreground",
  }

  return (
    <div className="flex items-start gap-3 p-2">
      <div className="relative mt-1">
        <div className={`h-2 w-2 rounded-full ${colors[type]}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="whitespace-nowrap text-xs text-muted-foreground">{time}</span>
    </div>
  )
}
