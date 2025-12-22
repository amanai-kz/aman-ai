"use client"

import { useState, useEffect } from "react"
import { 
  FileText, Download, Trash2, AlertTriangle, Clock, 
  Heart, Moon, Brain, Activity, ChevronRight, Loader2,
  Calendar, Phone
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
        setSelectedReport(null)
      }
    } catch (err) {
      alert("Өшіру мүмкін болмады / Не удалось удалить")
    }
  }

  const downloadPDF = async (report: VoiceReport) => {
    // Dynamic import jsPDF
    const { jsPDF } = await import("jspdf")
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Header
    doc.setFontSize(20)
    doc.setTextColor(0, 128, 128)
    doc.text("AMAN AI", pageWidth / 2, 20, { align: "center" })
    
    doc.setFontSize(12)
    doc.setTextColor(100)
    doc.text("Health Assessment Report / Densaulyq Esebi", pageWidth / 2, 28, { align: "center" })
    
    // Line
    doc.setDrawColor(0, 128, 128)
    doc.line(20, 35, pageWidth - 20, 35)
    
    // Report info
    doc.setFontSize(10)
    doc.setTextColor(0)
    
    const date = new Date(report.createdAt).toLocaleString("kk-KZ")
    doc.text(`Date / Kuni: ${date}`, 20, 45)
    doc.text(`Duration / Uzaktygy: ${report.callDuration ? Math.round(report.callDuration / 60) + " min" : "N/A"}`, 20, 52)
    doc.text(`Risk Level / Qaup dengei: ${report.riskLevel || "N/A"}`, 20, 59)
    
    // Summary
    doc.setFontSize(14)
    doc.setTextColor(0, 100, 100)
    doc.text("Summary / Qorytyndy", 20, 75)
    
    doc.setFontSize(10)
    doc.setTextColor(0)
    
    // Split summary into lines
    const summaryLines = doc.splitTextToSize(report.summary, pageWidth - 40)
    doc.text(summaryLines, 20, 85)
    
    // Quick stats
    const statsY = 85 + summaryLines.length * 5 + 15
    
    doc.setFontSize(14)
    doc.setTextColor(0, 100, 100)
    doc.text("Indicators / Korsekishter", 20, statsY)
    
    doc.setFontSize(10)
    doc.setTextColor(0)
    
    const stats = [
      `General Wellbeing / Jalpy jagdai: ${report.generalWellbeing || "N/A"}/10`,
      `Sleep Quality / Uiqy sapasy: ${report.sleepQuality || "N/A"}`,
      `Mood / Konil-kui: ${report.moodState || "N/A"}`,
      `Stress Level / Stress dengei: ${report.stressLevel || "N/A"}`,
    ]
    
    stats.forEach((stat, i) => {
      doc.text(stat, 20, statsY + 10 + i * 7)
    })
    
    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      "This report is AI-generated and should be reviewed by a healthcare professional.",
      pageWidth / 2, 
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    )
    doc.text(
      "AMAN AI Platform - amanai.kz",
      pageWidth / 2, 
      doc.internal.pageSize.getHeight() - 12,
      { align: "center" }
    )
    
    // Download
    doc.save(`AMAN_AI_Report_${new Date(report.createdAt).toISOString().split("T")[0]}.pdf`)
  }

  const getRiskColor = (level: string | null) => {
    switch (level) {
      case "CRITICAL": return "text-red-500 bg-red-500/10"
      case "HIGH": return "text-orange-500 bg-orange-500/10"
      case "MODERATE": return "text-yellow-500 bg-yellow-500/10"
      default: return "text-emerald-500 bg-emerald-500/10"
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📋 Есептер / Отчёты</h1>
          <p className="text-muted-foreground">
            AI-мен сөйлесуден жасалған денсаулық есептері
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
            <p className="text-muted-foreground">Пока нет отчётов</p>
            <p className="text-sm text-muted-foreground mt-4">
              Голосовой ассистентпен сөйлесіңіз — есеп автоматты түрде жасалады
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Барлық есептер ({reports.length})
              </h2>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedReport?.id === report.id
                        ? "bg-emerald-500/10 border-emerald-500/50"
                        : "bg-background/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {report.urgentAttention && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskColor(report.riskLevel)}`}>
                            {report.riskLevel || "LOW"}
                          </span>
                        </div>
                        
                        <p className="font-medium text-sm truncate">{report.title}</p>
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(report.createdAt).toLocaleDateString("kk-KZ")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(report.callDuration)}
                          </span>
                        </div>
                      </div>
                      
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Detail */}
            <div className="lg:col-span-2">
              {selectedReport ? (
                <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold">{selectedReport.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedReport.createdAt).toLocaleString("kk-KZ")}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadPDF(selectedReport)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        PDF
                      </button>
                      <button
                        onClick={() => deleteReport(selectedReport.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-muted/30">
                      <Heart className="w-5 h-5 text-rose-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Жалпы жағдай</p>
                      <p className="text-xl font-bold">{selectedReport.generalWellbeing || "—"}/10</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30">
                      <Moon className="w-5 h-5 text-indigo-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Ұйқы</p>
                      <p className="text-lg font-semibold">{selectedReport.sleepQuality || "—"}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30">
                      <Brain className="w-5 h-5 text-purple-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Көңіл-күй</p>
                      <p className="text-lg font-semibold">{selectedReport.moodState || "—"}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30">
                      <Activity className="w-5 h-5 text-amber-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Стресс</p>
                      <p className="text-lg font-semibold">{selectedReport.stressLevel || "—"}</p>
                    </div>
                  </div>

                  {/* Flags */}
                  {(selectedReport.urgentAttention || selectedReport.requiresFollowup) && (
                    <div className="flex gap-3 mb-6">
                      {selectedReport.urgentAttention && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">Шұғыл назар аудару керек!</span>
                        </div>
                      )}
                      {selectedReport.requiresFollowup && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium">Бақылау қажет</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Summary */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-500" />
                      Толық есеп / Полный отчёт
                    </h3>
                    <div className="p-4 rounded-xl bg-muted/20 prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {selectedReport.summary}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg text-muted-foreground">
                    Есепті таңдаңыз / Выберите отчёт
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

