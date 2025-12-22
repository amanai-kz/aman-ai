"use client"

import { useState, useEffect } from "react"
import { 
  FileText, Download, Trash2, AlertTriangle, Clock, 
  Heart, Moon, Brain, Activity, ChevronRight, Loader2,
  Calendar, Phone, Stethoscope, CheckCircle2
} from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"

interface VoiceReport {
  id: string
  vapiCallId: string
  callDuration: number | null
  title: string
  summary: string
  generalWellbeing: number | null
  sleepQuality: string | null
  moodState: string | null
  stressLevel: string | null
  riskLevel: string | null
  requiresFollowup: boolean
  urgentAttention: boolean
  createdAt: string
}

export default function ReportsPage() {
  const [reports, setReports] = useState<VoiceReport[]>([])
  const [selectedReport, setSelectedReport] = useState<VoiceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/reports")
      const data = await res.json()
      if (data.reports) {
        setReports(data.reports)
        // Auto-select first report
        if (data.reports.length > 0) {
          setSelectedReport(data.reports[0])
        }
      }
    } catch (err) {
      setError("Есептерді жүктеу мүмкін болмады / Не удалось загрузить отчёты")
    } finally {
      setLoading(false)
    }
  }

  const deleteReport = async (id: string) => {
    if (!confirm("Есепті өшіру? / Удалить отчёт?")) return
    
    try {
      await fetch(`/api/reports/${id}`, { method: "DELETE" })
      setReports(reports.filter(r => r.id !== id))
      if (selectedReport?.id === id) {
        setSelectedReport(reports.length > 1 ? reports[0] : null)
      }
    } catch (err) {
      alert("Өшіру мүмкін болмады / Не удалось удалить")
    }
  }

  const downloadReport = (report: VoiceReport) => {
    const date = new Date(report.createdAt).toLocaleString("kk-KZ")
    
    const content = `
═══════════════════════════════════════════════════════════
                        AMAN AI
              Денсаулық бағалау есебі
              Health Assessment Report
═══════════════════════════════════════════════════════════

Күні / Дата: ${date}
Ұзақтығы / Длительность: ${report.callDuration ? Math.round(report.callDuration / 60) + " мин" : "—"}
Қауіп деңгейі / Уровень риска: ${report.riskLevel || "LOW"}

───────────────────────────────────────────────────────────
                    КӨРСЕТКІШТЕР / ПОКАЗАТЕЛИ
───────────────────────────────────────────────────────────

Жалпы жағдай / Общее состояние: ${report.generalWellbeing || "—"}/10
Ұйқы сапасы / Качество сна: ${report.sleepQuality || "—"}
Көңіл-күй / Настроение: ${report.moodState || "—"}
Стресс деңгейі / Уровень стресса: ${report.stressLevel || "—"}

───────────────────────────────────────────────────────────
                      ЕСЕП / ОТЧЁТ
───────────────────────────────────────────────────────────

${report.summary}

───────────────────────────────────────────────────────────

⚠️ Бұл есеп AI арқылы жасалған. 
   Толық диагноз үшін дәрігерге хабарласыңыз.

   Этот отчёт сгенерирован AI. 
   Для полной диагностики обратитесь к врачу.

═══════════════════════════════════════════════════════════
                  AMAN AI Platform
                    amanai.kz
═══════════════════════════════════════════════════════════
`
    
    // Download as text file
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `AMAN_AI_Report_${new Date(report.createdAt).toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getRiskColor = (level: string | null) => {
    switch (level) {
      case "CRITICAL": return "text-red-500 bg-red-500/10 border-red-500/30"
      case "HIGH": return "text-orange-500 bg-orange-500/10 border-orange-500/30"
      case "MODERATE": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30"
      default: return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Parse summary into sections
  const parseSummary = (summary: string) => {
    const sections: { title: string; content: string; icon: React.ReactNode }[] = []
    
    const patterns = [
      { regex: /ЖАЛПЫ ЖАҒДАЙ.*?ОБЩЕЕ СОСТОЯНИЕ[:\s]*(.*?)(?=ҰЙҚЫ|СОН|$)/is, title: "Жалпы жағдай", icon: <Heart className="w-4 h-4 text-rose-500" /> },
      { regex: /ҰЙҚЫ.*?СОН[:\s]*(.*?)(?=КӨҢІЛ|НАСТРОЕНИЕ|$)/is, title: "Ұйқы", icon: <Moon className="w-4 h-4 text-indigo-500" /> },
      { regex: /КӨҢІЛ-КҮЙ.*?НАСТРОЕНИЕ[:\s]*(.*?)(?=СТРЕСС|$)/is, title: "Көңіл-күй", icon: <Brain className="w-4 h-4 text-purple-500" /> },
      { regex: /СТРЕСС ДЕҢГЕЙІ.*?УРОВЕНЬ СТРЕССА[:\s]*(.*?)(?=ФИЗИКАЛЫҚ|ФИЗИЧЕСКИЕ|$)/is, title: "Стресс деңгейі", icon: <Activity className="w-4 h-4 text-amber-500" /> },
      { regex: /ФИЗИКАЛЫҚ.*?ФИЗИЧЕСКИЕ СИМПТОМЫ[:\s]*(.*?)(?=КОГНИТИВТІ|КОГНИТИВНЫЕ|$)/is, title: "Физикалық симптомдар", icon: <Stethoscope className="w-4 h-4 text-blue-500" /> },
      { regex: /ҚОРЫТЫНДЫ.*?ЗАКЛЮЧЕНИЕ[:\s]*(.*?)(?=ҰСЫНЫСТАР|РЕКОМЕНДАЦИИ|$)/is, title: "Қорытынды", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
      { regex: /ҰСЫНЫСТАР.*?РЕКОМЕНДАЦИИ[:\s]*(.*?)$/is, title: "Ұсыныстар", icon: <FileText className="w-4 h-4 text-teal-500" /> },
    ]
    
    for (const { regex, title, icon } of patterns) {
      const match = summary.match(regex)
      if (match && match[1]?.trim()) {
        sections.push({ title, content: match[1].trim(), icon })
      }
    }
    
    return sections.length > 0 ? sections : null
  }

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📋 Денсаулық есептері</h1>
          <p className="text-muted-foreground">
            AI көмекшісімен сөйлесуден жасалған есептер
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl text-muted-foreground">Әзірше есептер жоқ</p>
            <p className="text-sm text-muted-foreground mt-4">
              Дауыстық көмекшімен сөйлесіңіз — есеп автоматты түрде жасалады
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="lg:col-span-1">
              <div className="bg-background/40 backdrop-blur-sm rounded-2xl border p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    {reports.length} есеп
                  </span>
                </div>
                
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`p-3 rounded-xl cursor-pointer transition-all ${
                        selectedReport?.id === report.id
                          ? "bg-emerald-500/15 border border-emerald-500/40"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          report.riskLevel === "HIGH" || report.riskLevel === "CRITICAL" 
                            ? "bg-red-500" 
                            : report.riskLevel === "MODERATE" 
                              ? "bg-yellow-500" 
                              : "bg-emerald-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {new Date(report.createdAt).toLocaleDateString("kk-KZ", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {formatDuration(report.callDuration)}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Report Detail */}
            <div className="lg:col-span-2">
              {selectedReport ? (
                <div className="bg-background/60 backdrop-blur-sm rounded-2xl border overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(selectedReport.riskLevel)}`}>
                            {selectedReport.riskLevel === "LOW" ? "Қалыпты" : 
                             selectedReport.riskLevel === "MODERATE" ? "Орташа" :
                             selectedReport.riskLevel === "HIGH" ? "Жоғары" : "Төмен"}
                          </span>
                          {selectedReport.urgentAttention && (
                            <span className="flex items-center gap-1 text-xs text-red-500">
                              <AlertTriangle className="w-3 h-3" />
                              Назар аудару
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold">
                          {new Date(selectedReport.createdAt).toLocaleDateString("kk-KZ", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          })}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Сөйлесу ұзақтығы: {formatDuration(selectedReport.callDuration)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadReport(selectedReport)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium"
                        >
<Download className="w-4 h-4" />
                        Жүктеу
                        </button>
                        <button
                          onClick={() => deleteReport(selectedReport.id)}
                          className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Өшіру"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 border-b">
                    <div className="p-4 text-center border-r">
                      <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                      <p className="text-lg font-bold">{selectedReport.generalWellbeing || "—"}</p>
                      <p className="text-xs text-muted-foreground">Жағдай</p>
                    </div>
                    <div className="p-4 text-center border-r">
                      <Moon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                      <p className="text-lg font-bold">{selectedReport.sleepQuality || "—"}</p>
                      <p className="text-xs text-muted-foreground">Ұйқы</p>
                    </div>
                    <div className="p-4 text-center border-r">
                      <Brain className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                      <p className="text-lg font-bold">{selectedReport.moodState || "—"}</p>
                      <p className="text-xs text-muted-foreground">Көңіл-күй</p>
                    </div>
                    <div className="p-4 text-center">
                      <Activity className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                      <p className="text-lg font-bold">{selectedReport.stressLevel || "—"}</p>
                      <p className="text-xs text-muted-foreground">Стресс</p>
                    </div>
                  </div>

                  {/* Report Content */}
                  <div className="p-6">
                    {parseSummary(selectedReport.summary) ? (
                      <div className="space-y-4">
                        {parseSummary(selectedReport.summary)?.map((section, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-muted/20 border border-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                              {section.icon}
                              <h4 className="font-semibold text-sm">{section.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {section.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-muted/20">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedReport.summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t bg-muted/10">
                    <p className="text-xs text-muted-foreground text-center">
                      Бұл есеп AI арқылы жасалған. Толық диагноз үшін дәрігерге хабарласыңыз.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg text-muted-foreground">
                    Есепті таңдаңыз
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
