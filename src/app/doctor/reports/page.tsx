"use client"

import { useState, useEffect } from "react"
import { useAppLocale } from "@/components/providers/locale-provider"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardBackground } from "@/components/dashboard-background"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getDoctorReportsCopy } from "@/lib/doctor-reports"
import { 
  FileText, 
  Search,
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
  const { locale } = useAppLocale()
  const copy = getDoctorReportsCopy(locale)
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

  const downloadReport = () => {
    if (!selectedReport) return
    
    const filename = `AMAN_AI_Report_${selectedReport.patientName?.replace(/\s/g, "_") || "Patient"}_${new Date(selectedReport.createdAt).toISOString().split("T")[0]}.txt`
    
    const content = `
═══════════════════════════════════════════════════════════════
                    AMAN AI - ${copy.pageTitle.toUpperCase()}
═══════════════════════════════════════════════════════════════

PATIENT: ${selectedReport.patientName || copy.anonymousPatient}
DATE: ${new Date(selectedReport.createdAt).toLocaleString(locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU")}
${copy.duration.toUpperCase()}: ${selectedReport.callDuration ? Math.round(selectedReport.callDuration / 60) + " min" : "—"}
RISK LEVEL: ${selectedReport.riskLevel || "LOW"}

───────────────────────────────────────────────────────────────
                       ОСНОВНЫЕ ПОКАЗАТЕЛИ
───────────────────────────────────────────────────────────────

• Общее самочувствие: ${selectedReport.generalWellbeing || "—"}/10
• Качество сна: ${selectedReport.sleepQuality || "—"}
• Настроение: ${selectedReport.moodState || "—"}
• Уровень стресса: ${selectedReport.stressLevel || "—"}

───────────────────────────────────────────────────────────────
                         ПОЛНЫЙ ОТЧЁТ
───────────────────────────────────────────────────────────────

${selectedReport.summary}

───────────────────────────────────────────────────────────────
${selectedReport.urgentAttention ? `⚠️ ${copy.urgent.toUpperCase()}!\n` : ""}${selectedReport.requiresFollowup ? `📞 ${copy.followup.toUpperCase()}\n` : ""}
───────────────────────────────────────────────────────────────
${copy.footer} • amanai.kz
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

  type SectionType = "general" | "sleep" | "mood" | "stress" | "symptoms" | "conclusion" | "recommendations" | "other"
  
  interface SummarySection {
    type: SectionType
    title: string
    content: string
  }
  
  const parseSummary = (summary: string): SummarySection[] => {
    if (!summary) return []
    
    const sections: SummarySection[] = []
    
    const sectionPatterns = [
      { pattern: /(?:жалпы жағдай|общее состояние|general condition)[:\s]*/gi, type: "general" as const, title: copy.sectionTitles.general },
      { pattern: /(?:ұйқы|сон|sleep)[:\s]*/gi, type: "sleep" as const, title: copy.sectionTitles.sleep },
      { pattern: /(?:көңіл-күй|настроение|mood)[:\s]*/gi, type: "mood" as const, title: copy.sectionTitles.mood },
      { pattern: /(?:стресс|stress)[:\s]*/gi, type: "stress" as const, title: copy.sectionTitles.stress },
      { pattern: /(?:симптом|symptom|белгі)[:\s]*/gi, type: "symptoms" as const, title: copy.sectionTitles.symptoms },
      { pattern: /(?:қорытынды|заключение|conclusion|резюме|summary)[:\s]*/gi, type: "conclusion" as const, title: copy.sectionTitles.conclusion },
      { pattern: /(?:ұсыныс|рекоменд|recommendation)[:\s]*/gi, type: "recommendations" as const, title: copy.sectionTitles.recommendations },
    ]
    
    const numberedPattern = /(?:^|\n)(?:\d+[\.\)]\s*|[-•]\s*)/g
    const hasBullets = numberedPattern.test(summary)
    
    if (hasBullets) {
      const items = summary.split(/(?:^|\n)(?:\d+[\.\)]\s*|[-•]\s*)/).filter(item => item.trim())
      
      items.forEach(item => {
        const trimmedItem = item.trim()
        let matched = false
        
        for (const { pattern, type, title } of sectionPatterns) {
          if (pattern.test(trimmedItem)) {
            const content = trimmedItem.replace(pattern, "").trim()
            if (content) {
              sections.push({ type, title, content })
              matched = true
            }
            break
          }
        }
        
        if (!matched && trimmedItem) {
          if (/рекоменд|ұсын|совет|follow|need|should/i.test(trimmedItem)) {
            sections.push({ type: "recommendations", title: copy.sectionTitles.recommendations, content: trimmedItem })
          } else {
            sections.push({ type: "other", title: copy.sectionTitles.other, content: trimmedItem })
          }
        }
      })
    } else {
      const lines = summary.split(/\n+/).filter(line => line.trim())
      let currentSection: SummarySection | null = null
      
      lines.forEach(line => {
        const trimmedLine = line.trim()
        let foundHeader = false
        
        for (const { pattern, type, title } of sectionPatterns) {
          if (pattern.test(trimmedLine)) {
            if (currentSection) {
              sections.push(currentSection)
            }
            const content = trimmedLine.replace(pattern, "").trim()
            currentSection = { type, title, content }
            foundHeader = true
            break
          }
        }
        
        if (!foundHeader && currentSection) {
          currentSection.content += "\n" + trimmedLine
        } else if (!foundHeader && !currentSection) {
          currentSection = { type: "conclusion", title: copy.sectionTitles.conclusion, content: trimmedLine }
        }
      })
      
      if (currentSection) {
        sections.push(currentSection)
      }
    }
    
    if (sections.length === 0 && summary.trim()) {
      return [{ type: "conclusion", title: copy.sectionTitles.conclusion, content: summary.trim() }]
    }
    
    const merged: SummarySection[] = []
    sections.forEach(section => {
      const existing = merged.find(s => s.type === section.type)
      if (existing) {
        existing.content += "\n" + section.content
      } else {
        merged.push({ ...section })
      }
    })
    
    return merged
  }

  const getSectionStyle = (type: SectionType): { bg: string; border: string } => {
    const styles: Record<SectionType, { bg: string; border: string }> = {
      general: { bg: "bg-gradient-to-br from-blue-500/10 to-cyan-500/10", border: "border-blue-500/20" },
      sleep: { bg: "bg-gradient-to-br from-indigo-500/10 to-purple-500/10", border: "border-indigo-500/20" },
      mood: { bg: "bg-gradient-to-br from-pink-500/10 to-rose-500/10", border: "border-pink-500/20" },
      stress: { bg: "bg-gradient-to-br from-orange-500/10 to-amber-500/10", border: "border-orange-500/20" },
      symptoms: { bg: "bg-gradient-to-br from-red-500/10 to-rose-500/10", border: "border-red-500/20" },
      conclusion: { bg: "bg-gradient-to-br from-emerald-500/10 to-teal-500/10", border: "border-emerald-500/20" },
      recommendations: { bg: "bg-gradient-to-br from-amber-500/10 to-yellow-500/10", border: "border-amber-500/20" },
      other: { bg: "bg-slate-500/10", border: "border-slate-500/20" },
    }
    return styles[type]
  }

  const getSectionIconBg = (type: SectionType): string => {
    const bgs: Record<SectionType, string> = {
      general: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20",
      sleep: "bg-gradient-to-br from-indigo-500/20 to-purple-500/20",
      mood: "bg-gradient-to-br from-pink-500/20 to-rose-500/20",
      stress: "bg-gradient-to-br from-orange-500/20 to-amber-500/20",
      symptoms: "bg-gradient-to-br from-red-500/20 to-rose-500/20",
      conclusion: "bg-emerald-500/20",
      recommendations: "bg-amber-500/20",
      other: "bg-slate-500/20",
    }
    return bgs[type]
  }

  const getSectionIcon = (type: SectionType) => {
    switch (type) {
      case "general": return <Activity className="w-5 h-5 text-blue-400" />
      case "sleep": return <Moon className="w-5 h-5 text-indigo-400" />
      case "mood": return <Heart className="w-5 h-5 text-pink-400" />
      case "stress": return <Activity className="w-5 h-5 text-orange-400" />
      case "symptoms": return <Brain className="w-5 h-5 text-red-400" />
      case "conclusion": return <FileText className="w-5 h-5 text-emerald-400" />
      case "recommendations": return <FileText className="w-5 h-5 text-amber-400" />
      default: return <FileText className="w-5 h-5 text-slate-400" />
    }
  }

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="flex-1 overflow-auto relative pb-20 lg:pb-0">
        <DashboardBackground />
        
        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-medium tracking-tight mb-1">{copy.heading}</h2>
              <p className="text-muted-foreground text-sm">
                {reports.length} {copy.subtitleSuffix} • {copy.subtitleDescription}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={copy.searchPlaceholder}
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
              <p className="text-xl text-muted-foreground">{copy.emptyTitle}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {copy.emptyDescription}
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Reports List */}
              <div className="lg:col-span-1">
                <div className="border rounded-2xl bg-background/60 backdrop-blur-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <span className="text-sm font-medium">{filteredReports.length} {copy.listCountSuffix}</span>
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
                                {report.riskLevel === "CRITICAL"
                                  ? copy.riskLabels.critical
                                  : report.riskLevel === "HIGH"
                                    ? copy.riskLabels.high
                                    : report.riskLevel === "MODERATE"
                                      ? copy.riskLabels.moderate
                                      : copy.riskLabels.low}
                              </span>
                            </div>
                            <p className="text-sm font-medium">
                              {report.patientName || copy.anonymousShort}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>
                                {new Date(report.createdAt).toLocaleDateString(locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU", {
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
                              {selectedReport.riskLevel === "LOW"
                                ? copy.riskLabels.low
                                : selectedReport.riskLevel === "MODERATE"
                                  ? copy.riskLabels.moderate
                                  : selectedReport.riskLevel === "HIGH"
                                    ? copy.riskLabels.high
                                    : copy.riskLabels.critical}
                            </span>
                            {selectedReport.urgentAttention && (
                              <span className="flex items-center gap-1 text-xs text-red-500">
                                <AlertTriangle className="w-3 h-3" />
                                {copy.urgent}
                              </span>
                            )}
                            {selectedReport.requiresFollowup && (
                              <span className="text-xs text-amber-500">
                                {copy.followup}
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-bold">
                            {selectedReport.patientName || copy.anonymousPatient}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(selectedReport.createdAt).toLocaleDateString(locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })} • {copy.duration}: {formatDuration(selectedReport.callDuration)}
                          </p>
                        </div>
                        
                        <Button onClick={downloadReport} className="gap-2">
                          <Download className="w-4 h-4" />
                          {copy.download}
                        </Button>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-4 border-b">
                      <div className="p-4 text-center border-r">
                        <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedReport.generalWellbeing || "—"}</p>
                        <p className="text-xs text-muted-foreground">{copy.stats.wellbeing}</p>
                      </div>
                      <div className="p-4 text-center border-r">
                        <Moon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedReport.sleepQuality || "—"}</p>
                        <p className="text-xs text-muted-foreground">{copy.stats.sleep}</p>
                      </div>
                      <div className="p-4 text-center border-r">
                        <Brain className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedReport.moodState || "—"}</p>
                        <p className="text-xs text-muted-foreground">{copy.stats.mood}</p>
                      </div>
                      <div className="p-4 text-center">
                        <Activity className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{selectedReport.stressLevel || "—"}</p>
                        <p className="text-xs text-muted-foreground">{copy.stats.stress}</p>
                      </div>
                    </div>

                    {/* Report Content - Structured Summary */}
                    <div className="p-6 space-y-4">
                      {parseSummary(selectedReport.summary).map((section, index) => {
                        const style = getSectionStyle(section.type)
                        return (
                          <div 
                            key={index}
                            className={`rounded-xl border p-5 transition-colors ${style.bg} ${style.border}`}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getSectionIconBg(section.type)}`}>
                                {getSectionIcon(section.type)}
                              </div>
                              <h4 className="font-semibold">{section.title}</h4>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {section.content}
                            </p>
                          </div>
                        )
                      })}
                      
                      {/* Fallback if no sections */}
                      {parseSummary(selectedReport.summary).length === 0 && (
                        <div className="rounded-xl border bg-background/60 p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h4 className="font-semibold">{copy.fallbackSummaryTitle}</h4>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedReport.summary}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-muted/10">
                      <p className="text-xs text-muted-foreground text-center">
                        {copy.footer}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-2xl bg-background/60 p-12 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg text-muted-foreground">
                      {copy.selectPrompt}
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
