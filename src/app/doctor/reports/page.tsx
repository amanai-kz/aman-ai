"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardBackground } from "@/components/dashboard-background"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  Search,
  Calendar,
  Clock,
  Download,
  ChevronRight,
  Loader2,
  Heart,
  Moon,
  Brain,
  Activity,
  AlertTriangle,
  Mic,
} from "lucide-react"

interface VoiceReport {
  id: string
  vapiCallId: string
  callDuration: number | null
  patientId: string | null
  patientName: string | null
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

export default function DoctorReportsPage() {
  const [reports, setReports] = useState<VoiceReport[]>([])
  const [selectedReport, setSelectedReport] = useState<VoiceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/reports")
      const data = await res.json()
      if (data.reports) {
        setReports(data.reports)
        if (data.reports.length > 0) {
          setSelectedReport(data.reports[0])
        }
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err)
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = async () => {
    if (!selectedReport) return
    
    const reportElement = document.getElementById("report-content")
    if (!reportElement) return

    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      })
      
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 10
      
      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`AMAN_AI_Report_${new Date(selectedReport.createdAt).toISOString().split("T")[0]}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
    }
  }

  const getRiskColor = (level: string | null) => {
    switch (level) {
      case "CRITICAL": return "bg-red-500/10 text-red-500 border-red-500/30"
      case "HIGH": return "bg-orange-500/10 text-orange-500 border-orange-500/30"
      case "MODERATE": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
      default: return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const filteredReports = reports.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.summary.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Parse summary into sections
  const parseSummary = (summary: string): { title: string; content: string; iconType: string }[] | null => {
    const sections: { title: string; content: string; iconType: string }[] = []
    
    const patterns = [
      { regex: /ЖАЛПЫ ЖАҒДАЙ[\s\S]*?ОБЩЕЕ СОСТОЯНИЕ[:\s]*([\s\S]*?)(?=ҰЙҚЫ|СОН|$)/i, title: "Жалпы жағдай", iconType: "heart" },
      { regex: /ҰЙҚЫ[\s\S]*?СОН[:\s]*([\s\S]*?)(?=КӨҢІЛ|НАСТРОЕНИЕ|$)/i, title: "Ұйқы", iconType: "moon" },
      { regex: /КӨҢІЛ-КҮЙ[\s\S]*?НАСТРОЕНИЕ[:\s]*([\s\S]*?)(?=СТРЕСС|$)/i, title: "Көңіл-күй", iconType: "brain" },
      { regex: /СТРЕСС ДЕҢГЕЙІ[\s\S]*?УРОВЕНЬ СТРЕССА[:\s]*([\s\S]*?)(?=ФИЗИКАЛЫҚ|ФИЗИЧЕСКИЕ|$)/i, title: "Стресс деңгейі", iconType: "activity" },
      { regex: /ФИЗИКАЛЫҚ[\s\S]*?ФИЗИЧЕСКИЕ СИМПТОМЫ[:\s]*([\s\S]*?)(?=КОГНИТИВТІ|КОГНИТИВНЫЕ|$)/i, title: "Физикалық симптомдар", iconType: "stethoscope" },
      { regex: /ҚОРЫТЫНДЫ[\s\S]*?ЗАКЛЮЧЕНИЕ[:\s]*([\s\S]*?)(?=ҰСЫНЫСТАР|РЕКОМЕНДАЦИИ|$)/i, title: "Қорытынды", iconType: "check" },
      { regex: /ҰСЫНЫСТАР[\s\S]*?РЕКОМЕНДАЦИИ[:\s]*([\s\S]*?)$/i, title: "Ұсыныстар", iconType: "file" },
    ]
    
    for (const { regex, title, iconType } of patterns) {
      const match = summary.match(regex)
      if (match && match[1]?.trim()) {
        sections.push({ title, content: match[1].trim(), iconType })
      }
    }
    
    return sections.length > 0 ? sections : null
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "heart": return <Heart className="w-4 h-4 text-rose-500" />
      case "moon": return <Moon className="w-4 h-4 text-indigo-500" />
      case "brain": return <Brain className="w-4 h-4 text-purple-500" />
      case "activity": return <Activity className="w-4 h-4 text-amber-500" />
      case "check": return <FileText className="w-4 h-4 text-emerald-500" />
      case "file": return <FileText className="w-4 h-4 text-teal-500" />
      default: return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <>
      <DashboardHeader title="Пациент есептері" />
      <div className="flex-1 overflow-auto relative pb-20 lg:pb-0">
        <DashboardBackground />
        
        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-medium tracking-tight mb-1">AI Голосовые есептер</h2>
              <p className="text-muted-foreground text-sm">
                {reports.length} есеп • Дауыстық көмекшімен сөйлесуден жасалған
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Іздеу..." 
                className="pl-10 w-[200px]" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20 border rounded-2xl bg-background/60">
              <Mic className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-xl text-muted-foreground">Әзірше есептер жоқ</p>
              <p className="text-sm text-muted-foreground mt-2">
                Пациенттер дауыстық көмекшімен сөйлескенде есептер пайда болады
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Reports List */}
              <div className="lg:col-span-1">
                <div className="border rounded-2xl bg-background/60 backdrop-blur-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <span className="text-sm font-medium">{filteredReports.length} есеп</span>
                  </div>
                  
                  <div className="max-h-[600px] overflow-y-auto">
                    {filteredReports.map((report) => (
                      <div
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={`p-4 border-b cursor-pointer transition-colors ${
                          selectedReport?.id === report.id
                            ? "bg-emerald-500/10"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {report.urgentAttention && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskColor(report.riskLevel)}`}>
                                {report.riskLevel || "LOW"}
                              </span>
                            </div>
                            <p className="text-sm font-medium">
                              {report.patientName || "Анонимный"}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>
                                {new Date(report.createdAt).toLocaleDateString("kk-KZ", {
                                  day: "numeric",
                                  month: "short"
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(report.callDuration)}
                              </span>
                            </div>
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
                  <div id="report-content" className="border rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
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
                                Шұғыл
                              </span>
                            )}
                            {selectedReport.requiresFollowup && (
                              <span className="text-xs text-amber-500">
                                Бақылау қажет
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-bold">
                            {selectedReport.patientName || "Анонимный пациент"}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(selectedReport.createdAt).toLocaleDateString("kk-KZ", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })} • Ұзақтығы: {formatDuration(selectedReport.callDuration)}
                          </p>
                        </div>
                        
                        <Button onClick={downloadPDF} className="gap-2">
                          <Download className="w-4 h-4" />
                          Жүктеу
                        </Button>
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
                                {getIcon(section.iconType)}
                                <h4 className="font-semibold text-sm">{section.title}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {section.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-muted/20 border">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedReport.summary}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-muted/10">
                      <p className="text-xs text-muted-foreground text-center">
                        AI арқылы жасалған есеп • AMAN AI Platform
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-2xl bg-background/60 p-12 text-center">
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
    </>
  )
}
