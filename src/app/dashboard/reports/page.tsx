"use client"

import { useState, useEffect } from "react"
import { 
  FileText, Download, Trash2, AlertTriangle, Clock, 
  Heart, Moon, Brain, Activity, ChevronRight, Loader2,
  Stethoscope, CheckCircle2, User, Zap, AudioLines, Phone
} from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"
import { cn } from "@/lib/utils"

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

interface ConsultationReport {
  id: string
  patientName: string | null
  recordingDuration: number | null
  title: string
  generalCondition: string | null
  sleep: string | null
  mood: string | null
  stress: string | null
  physicalSymptoms: string | null
  conclusion: string | null
  recommendations: string | null
  rawDialogue: string | null
  createdAt: string
}

interface DialogueLine {
  speaker: "doctor" | "patient"
  text: string
}

function parseDialogue(rawDialogue: string): DialogueLine[] {
  const lines = rawDialogue.split("\n").filter(line => line.trim())
  return lines.map(line => {
    const isDoctor = line.startsWith("SPEAKER_00:")
    const text = line.replace(/^SPEAKER_0[01]:\s*/, "").trim()
    return {
      speaker: isDoctor ? "doctor" : "patient",
      text
    }
  })
}

type TabType = "consultations" | "voice"

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("consultations")
  const [voiceReports, setVoiceReports] = useState<VoiceReport[]>([])
  const [consultationReports, setConsultationReports] = useState<ConsultationReport[]>([])
  const [selectedVoiceReport, setSelectedVoiceReport] = useState<VoiceReport | null>(null)
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchAllReports()
  }, [])

  const fetchAllReports = async () => {
    try {
      setLoading(true)
      
      // Fetch both types of reports in parallel
      const [voiceRes, consultationRes] = await Promise.all([
        fetch("/api/reports"),
        fetch("/api/consultation")
      ])
      
      const voiceData = await voiceRes.json()
      const consultationData = await consultationRes.json()
      
      if (voiceData.reports) {
        setVoiceReports(voiceData.reports)
      }
      
      if (consultationData.reports) {
        setConsultationReports(consultationData.reports)
        if (consultationData.reports.length > 0) {
          setSelectedConsultation(consultationData.reports[0])
        }
      }
      
      // Auto-select first voice report if no consultations
      if (voiceData.reports?.length > 0 && !consultationData.reports?.length) {
        setActiveTab("voice")
        setSelectedVoiceReport(voiceData.reports[0])
      }
      
    } catch (err) {
      console.error("Error fetching reports:", err)
      setError("Есептерді жүктеу мүмкін болмады / Не удалось загрузить отчёты")
    } finally {
      setLoading(false)
    }
  }

  const deleteVoiceReport = async (id: string) => {
    if (!confirm("Есепті өшіру? / Удалить отчёт?")) return
    
    try {
      await fetch(`/api/reports/${id}`, { method: "DELETE" })
      setVoiceReports(voiceReports.filter(r => r.id !== id))
      if (selectedVoiceReport?.id === id) {
        setSelectedVoiceReport(voiceReports.length > 1 ? voiceReports[0] : null)
      }
    } catch (err) {
      alert("Өшіру мүмкін болмады / Не удалось удалить")
    }
  }

  const deleteConsultationReport = async (id: string) => {
    if (!confirm("Есепті өшіру? / Удалить отчёт?")) return
    
    try {
      await fetch(`/api/consultation/${id}`, { method: "DELETE" })
      setConsultationReports(consultationReports.filter(r => r.id !== id))
      if (selectedConsultation?.id === id) {
        setSelectedConsultation(consultationReports.length > 1 ? consultationReports[0] : null)
      }
    } catch (err) {
      alert("Өшіру мүмкін болмады / Не удалось удалить")
    }
  }

  const downloadConsultationReport = () => {
    if (!selectedConsultation) return
    
    const filename = `Consultation_${new Date(selectedConsultation.createdAt).toISOString().split("T")[0]}.txt`
    
    const content = `
═══════════════════════════════════════════════════════════════
                    AMAN AI - ОТЧЁТ КОНСУЛЬТАЦИИ
═══════════════════════════════════════════════════════════════

ДАТА: ${new Date(selectedConsultation.createdAt).toLocaleString("ru-RU")}
ДЛИТЕЛЬНОСТЬ: ${selectedConsultation.recordingDuration ? Math.round(selectedConsultation.recordingDuration / 60) + " мин" : "—"}
ПАЦИЕНТ: ${selectedConsultation.patientName || "—"}

───────────────────────────────────────────────────────────────
                         ЗАКЛЮЧЕНИЕ
───────────────────────────────────────────────────────────────

${selectedConsultation.conclusion || "—"}

───────────────────────────────────────────────────────────────
                    ОСНОВНЫЕ ПОКАЗАТЕЛИ
───────────────────────────────────────────────────────────────

• Общее состояние: ${selectedConsultation.generalCondition || "—"}

• Сон: ${selectedConsultation.sleep || "—"}

• Настроение: ${selectedConsultation.mood || "—"}

• Стресс: ${selectedConsultation.stress || "—"}

• Физические симптомы: ${selectedConsultation.physicalSymptoms || "—"}

───────────────────────────────────────────────────────────────
                       РЕКОМЕНДАЦИИ
───────────────────────────────────────────────────────────────

${selectedConsultation.recommendations || "—"}

───────────────────────────────────────────────────────────────
                   РАСШИФРОВКА ДИАЛОГА
───────────────────────────────────────────────────────────────

${selectedConsultation.rawDialogue || "—"}

───────────────────────────────────────────────────────────────
Отчёт сгенерирован AI • AMAN AI Platform • amanai.kz
═══════════════════════════════════════════════════════════════
    `.trim()

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const dialogueLines = selectedConsultation?.rawDialogue 
    ? parseDialogue(selectedConsultation.rawDialogue) 
    : []

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📋 Отчёты</h1>
          <p className="text-muted-foreground">
            AI-отчёты от консультаций и голосового ассистента
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("consultations")}
            className={cn(
              "px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors",
              activeTab === "consultations"
                ? "bg-emerald-500 text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <AudioLines className="w-4 h-4" />
            Консультации
            {consultationReports.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {consultationReports.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("voice")}
            className={cn(
              "px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors",
              activeTab === "voice"
                ? "bg-emerald-500 text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Phone className="w-4 h-4" />
            Голосовой ассистент
            {voiceReports.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {voiceReports.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : activeTab === "consultations" ? (
          // ============ CONSULTATION REPORTS ============
          consultationReports.length === 0 ? (
            <div className="text-center py-20">
              <AudioLines className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-xl text-muted-foreground">Әзірше консультациялар жоқ</p>
              <p className="text-sm text-muted-foreground mt-4">
                Консультация жасап, нәтижені сақтаңыз
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Reports List */}
              <div className="lg:col-span-1">
                <div className="bg-background/40 backdrop-blur-sm rounded-2xl border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">
                      {consultationReports.length} отчёт
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {consultationReports.map((report) => (
                      <div
                        key={report.id}
                        onClick={() => setSelectedConsultation(report)}
                        className={`p-3 rounded-xl cursor-pointer transition-all ${
                          selectedConsultation?.id === report.id
                            ? "bg-emerald-500/15 border border-emerald-500/40"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {new Date(report.createdAt).toLocaleDateString("ru-RU", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDuration(report.recordingDuration)}
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
                {selectedConsultation ? (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-bold">
                            {new Date(selectedConsultation.createdAt).toLocaleDateString("ru-RU", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            Длительность: {formatDuration(selectedConsultation.recordingDuration)}
                            {selectedConsultation.patientName && ` • ${selectedConsultation.patientName}`}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={downloadConsultationReport}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Жүктеу
                          </button>
                          <button
                            onClick={() => deleteConsultationReport(selectedConsultation.id)}
                            className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Өшіру"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Conclusion */}
                    {selectedConsultation.conclusion && (
                      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Stethoscope className="w-5 h-5 text-emerald-500" />
                          </div>
                          <h3 className="text-lg font-semibold">Заключение</h3>
                        </div>
                        <p className="text-emerald-400 font-medium">{selectedConsultation.conclusion}</p>
                      </div>
                    )}

                    {/* Info Cards */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {selectedConsultation.generalCondition && (
                        <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                              <Activity className="w-4 h-4 text-blue-400" />
                            </div>
                            <h4 className="font-medium">Общее состояние</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedConsultation.generalCondition}</p>
                        </div>
                      )}
                      
                      {selectedConsultation.sleep && (
                        <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                              <Moon className="w-4 h-4 text-indigo-400" />
                            </div>
                            <h4 className="font-medium">Сон</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedConsultation.sleep}</p>
                        </div>
                      )}
                      
                      {selectedConsultation.mood && (
                        <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                              <Heart className="w-4 h-4 text-pink-400" />
                            </div>
                            <h4 className="font-medium">Настроение</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedConsultation.mood}</p>
                        </div>
                      )}
                      
                      {selectedConsultation.stress && (
                        <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                              <Zap className="w-4 h-4 text-orange-400" />
                            </div>
                            <h4 className="font-medium">Стресс</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedConsultation.stress}</p>
                        </div>
                      )}
                      
                      {selectedConsultation.physicalSymptoms && (
                        <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5 md:col-span-2">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                              <Brain className="w-4 h-4 text-red-400" />
                            </div>
                            <h4 className="font-medium">Физические симптомы</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedConsultation.physicalSymptoms}</p>
                        </div>
                      )}
                    </div>

                    {/* Recommendations */}
                    {selectedConsultation.recommendations && (
                      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-500" />
                          </div>
                          <h3 className="text-lg font-semibold">Рекомендации</h3>
                        </div>
                        <p className="text-muted-foreground">{selectedConsultation.recommendations}</p>
                      </div>
                    )}

                    {/* Dialogue */}
                    {dialogueLines.length > 0 && (
                      <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-purple-400" />
                          </div>
                          <h3 className="text-lg font-semibold">Расшифровка диалога</h3>
                        </div>
                        
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                          {dialogueLines.map((line, index) => (
                            <div 
                              key={index}
                              className={cn(
                                "flex gap-3",
                                line.speaker === "doctor" ? "flex-row" : "flex-row-reverse"
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                line.speaker === "doctor" 
                                  ? "bg-emerald-500/20" 
                                  : "bg-blue-500/20"
                              )}>
                                {line.speaker === "doctor" 
                                  ? <Stethoscope className="w-4 h-4 text-emerald-400" />
                                  : <User className="w-4 h-4 text-blue-400" />
                                }
                              </div>
                              <div className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3",
                                line.speaker === "doctor"
                                  ? "bg-emerald-500/10 rounded-tl-sm"
                                  : "bg-blue-500/10 rounded-tr-sm"
                              )}>
                                <p className="text-xs text-muted-foreground mb-1">
                                  {line.speaker === "doctor" ? "Врач" : "Пациент"}
                                </p>
                                <p className="text-sm">{line.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-12 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg text-muted-foreground">
                      Выберите отчёт
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          // ============ VOICE REPORTS ============
          voiceReports.length === 0 ? (
            <div className="text-center py-20">
              <Phone className="w-16 h-16 mx-auto mb-4 opacity-20" />
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
                      {voiceReports.length} есеп
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {voiceReports.map((report) => (
                      <div
                        key={report.id}
                        onClick={() => setSelectedVoiceReport(report)}
                        className={`p-3 rounded-xl cursor-pointer transition-all ${
                          selectedVoiceReport?.id === report.id
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
                {selectedVoiceReport ? (
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl border overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border",
                              selectedVoiceReport.riskLevel === "CRITICAL" ? "text-red-500 bg-red-500/10 border-red-500/30" :
                              selectedVoiceReport.riskLevel === "HIGH" ? "text-orange-500 bg-orange-500/10 border-orange-500/30" :
                              selectedVoiceReport.riskLevel === "MODERATE" ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" :
                              "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                            )}>
                              {selectedVoiceReport.riskLevel === "LOW" ? "Қалыпты" : 
                               selectedVoiceReport.riskLevel === "MODERATE" ? "Орташа" :
                               selectedVoiceReport.riskLevel === "HIGH" ? "Жоғары" : "Төмен"}
                            </span>
                            {selectedVoiceReport.urgentAttention && (
                              <span className="flex items-center gap-1 text-xs text-red-500">
                                <AlertTriangle className="w-3 h-3" />
                                Назар аудару
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-bold">
                            {new Date(selectedVoiceReport.createdAt).toLocaleDateString("kk-KZ", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            Сөйлесу ұзақтығы: {formatDuration(selectedVoiceReport.callDuration)}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => deleteVoiceReport(selectedVoiceReport.id)}
                          className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Өшіру"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-4 border-b">
                      <div className="p-4 text-center border-r">
                        <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedVoiceReport.generalWellbeing || "—"}</p>
                        <p className="text-xs text-muted-foreground">Жағдай</p>
                      </div>
                      <div className="p-4 text-center border-r">
                        <Moon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedVoiceReport.sleepQuality || "—"}</p>
                        <p className="text-xs text-muted-foreground">Ұйқы</p>
                      </div>
                      <div className="p-4 text-center border-r">
                        <Brain className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedVoiceReport.moodState || "—"}</p>
                        <p className="text-xs text-muted-foreground">Көңіл-күй</p>
                      </div>
                      <div className="p-4 text-center">
                        <Activity className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedVoiceReport.stressLevel || "—"}</p>
                        <p className="text-xs text-muted-foreground">Стресс</p>
                      </div>
                    </div>

                    {/* Report Content */}
                    <div className="p-6">
                      <div className="p-4 rounded-xl bg-muted/20">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedVoiceReport.summary}
                        </p>
                      </div>
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
          )
        )}
      </div>
    </div>
  )
}
