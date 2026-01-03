import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardBackground } from "@/components/dashboard-background"
import { db } from "@/lib/db"
import { 
  Clock, 
  Filter, 
  Search, 
  Calendar,
  Activity,
  FileText,
  Brain,
  Dna,
  Droplets,
  HeartPulse,
  Scan,
  ClipboardList,
  Stethoscope,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { computeDurationSeconds, formatDuration } from "@/lib/duration"
import { headers } from "next/headers"

const serviceIcons: Record<string, React.ElementType> = {
  CT_MRI: Scan,
  IOT: Activity,
  QUESTIONNAIRE: ClipboardList,
  GENETICS: Dna,
  BLOOD: Droplets,
  REHABILITATION: HeartPulse,
  CONSULTATION: Stethoscope,
}

type ConsultationApiReport = {
  id: string
  title: string
  createdAt: string
  recordingDuration: number | null
  conclusion?: string | null
  recommendations?: string | null
}

interface HistoryItem {
  id: string
  type: string
  title: string
  description: string
  date: Date
  status: string
  result?: {
    score?: number
    level?: string
    hrv?: number
    stress?: number
    findings?: number
    confidence?: number
  }
  durationSeconds?: number | null
}

export default async function HistoryPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // Get patient profile
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { patient: true },
  })

  const patientId = user?.patient?.id

  // Fetch consultation reports
  let consultationReports: ConsultationApiReport[] = []
  try {
    const host = (await headers()).get("host")
    const proto = (await headers()).get("x-forwarded-proto") ?? "http"
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (host ? `${proto}://${host}` : "")
    const apiUrl = baseUrl ? new URL("/api/consultation", baseUrl).toString() : "/api/consultation"

    const res = await fetch(apiUrl, {
      cache: "no-store",
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const data = await res.json()
      consultationReports = data.reports || []
    }
  } catch (error) {
    console.error("Failed to load consultation history", error)
  }

  // Build history from consultations
  const history: HistoryItem[] = consultationReports.map((report) => {
    const durationSeconds = computeDurationSeconds(
      report.createdAt,
      null,
      report.recordingDuration ?? null
    )

    return {
      id: report.id,
      type: "CONSULTATION",
      title: report.title || "Консультация",
      description: report.conclusion || report.recommendations || "Итог консультации",
      date: new Date(report.createdAt),
      status: "completed",
      durationSeconds,
    }
  })

  // Fetch real data from database if patient exists
  if (patientId) {
    // Fetch analyses
    const analyses = await db.analysis.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    for (const analysis of analyses) {
      history.push({
        id: analysis.id,
        type: analysis.serviceType,
        title: analysis.serviceType === "CT_MRI" ? "МРТ головного мозга" :
               analysis.serviceType === "GENETICS" ? "Генетический анализ" :
               analysis.serviceType === "BLOOD" ? "Анализ крови" : "Анализ",
        description: "AI анализ",
        date: analysis.createdAt,
        status: analysis.status === "REVIEWED" ? "reviewed" : 
                analysis.status === "COMPLETED" ? "completed" : 
                analysis.status === "FAILED" ? "failed" : "pending",
        result: {
          findings: Array.isArray(analysis.findings) ? analysis.findings.length : 0,
          confidence: analysis.confidence ?? undefined,
        },
      })
    }

    // Fetch IoT sessions
    const iotSessions = await db.iotSession.findMany({
      where: { patientId },
      orderBy: { startedAt: "desc" },
      take: 50,
    })

    for (const iotSession of iotSessions) {
      history.push({
        id: iotSession.id,
        type: "IOT",
        title: "IoT Мониторинг",
        description: iotSession.duration ? `Сессия ${Math.round(iotSession.duration / 60)} минут` : "Сессия",
        date: iotSession.startedAt,
        status: iotSession.endedAt ? "completed" : "pending",
        result: {
          hrv: iotSession.avgHeartRate ?? undefined,
          stress: iotSession.avgStressLevel ? Math.round(iotSession.avgStressLevel) : undefined,
        },
      })
    }

    // Fetch questionnaire results
    const questionnaires = await db.questionnaireResult.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    for (const q of questionnaires) {
      history.push({
        id: q.id,
        type: "QUESTIONNAIRE",
        title: q.questionnaireId === "PSS-10" ? "Опросник PSS-10" : 
               q.questionnaireId === "MMSE" ? "Опросник MMSE" : "Опросник",
        description: "Оценка уровня стресса",
        date: q.createdAt,
        status: "completed",
        result: {
          score: q.totalScore ?? undefined,
          level: q.category ?? undefined,
        },
      })
    }
  }

  // Sort by date
  history.sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <>
      <DashboardHeader title="История" />
      <div className="flex-1 overflow-auto relative pb-20 lg:pb-0">
        <DashboardBackground />
        
        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-medium tracking-tight mb-1">История анализов</h2>
              <p className="text-muted-foreground text-sm">Все ваши диагностики и результаты</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Поиск..." className="pl-10 w-[200px]" />
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Фильтр
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Activity} label="Всего анализов" value={history.length.toString()} />
            <StatCard icon={FileText} label="Опросников" value={history.filter(h => h.type === "QUESTIONNAIRE").length.toString()} />
            <StatCard icon={Brain} label="Снимков" value={history.filter(h => h.type === "CT_MRI").length.toString()} />
            <StatCard icon={Clock} label="IoT сессий" value={history.filter(h => h.type === "IOT").length.toString()} />
          </div>

          {/* Timeline */}
          <div className="border border-border rounded-2xl bg-background/60 backdrop-blur-sm overflow-hidden">
            {history.length > 0 ? (
              <div className="divide-y divide-border">
                {history.map((item, index) => {
                  const Icon = serviceIcons[item.type] || Activity
                  return (
                    <div
                      key={item.id}
                      className="p-5 hover:bg-secondary/30 transition-colors cursor-pointer group opacity-0 animate-fade-up"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-foreground group-hover:text-background transition-colors">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-medium text-sm">{item.title}</h4>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {formatDate(item.date)}
                              </p>
                              <StatusBadge status={item.status} />
                            </div>
                          </div>
                          
                          {/* Results preview */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.type === "CONSULTATION" && (
                              <ResultChip label="Длительность" value={formatDuration(item.durationSeconds ?? null)} />
                            )}
                            {item.type === "QUESTIONNAIRE" && item.result && (
                              <>
                                <ResultChip label="Балл" value={String(item.result.score ?? "—")} />
                                <ResultChip 
                                  label="Уровень" 
                                  value={item.result.level === "low" ? "Низкий" : item.result.level === "moderate" ? "Средний" : "Высокий"} 
                                />
                              </>
                            )}
                            {item.type === "IOT" && item.result && (
                              <>
                                <ResultChip label="HRV" value={`${item.result.hrv ?? 0} ms`} />
                                <ResultChip label="Стресс" value={`${item.result.stress ?? 0}%`} />
                              </>
                            )}
                            {item.type === "CT_MRI" && item.result && (
                              <>
                                <ResultChip label="Находки" value={String(item.result.findings ?? 0)} />
                                <ResultChip label="Уверенность" value={`${Math.round((item.result.confidence ?? 0) * 100)}%`} />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">История пуста</h3>
                <p className="text-sm text-muted-foreground">
                  Здесь будут отображаться все ваши анализы и диагностики
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-green-500/10 text-green-600",
    reviewed: "bg-blue-500/10 text-blue-600",
    failed: "bg-red-500/10 text-red-600",
  }

  const labels = {
    pending: "В обработке",
    completed: "Завершён",
    reviewed: "Проверен врачом",
    failed: "Ошибка",
  }

  return (
    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full ${styles[status as keyof typeof styles] || styles.pending}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  )
}

function ResultChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Сегодня"
  if (days === 1) return "Вчера"
  if (days < 7) return `${days} дн. назад`
  
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}
