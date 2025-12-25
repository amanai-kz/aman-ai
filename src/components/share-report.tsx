"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Share2, MessageCircle, Mail, Link2, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateConsultationPdf, ConsultationReportData } from "@/lib/pdf-generator"

interface ShareReportProps {
  reportType: "consultation" | "voice"
  reportData: {
    id: string
    title?: string
    conclusion?: string | null
    summary?: string
    recommendations?: string | null
    generalCondition?: string | null
    createdAt: string
    patientName?: string | null
    recordingDuration?: number | null
    dialogueProtocol?: string | null
  }
  disabled?: boolean
}

export function ShareReport({ reportType, reportData, disabled }: ShareReportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.right - 224, // 224px = w-56
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const getReportText = () => {
    const date = new Date(reportData.createdAt).toLocaleDateString("ru-RU")
    const summary = reportData.conclusion || reportData.summary || ""
    const recommendations = reportData.recommendations || ""
    
    let text = `🏥 AMAN AI - Отчёт от ${date}\n\n`
    
    if (summary) {
      text += `📋 Заключение:\n${summary}\n\n`
    }
    
    if (recommendations) {
      text += `💡 Рекомендации:\n${recommendations}\n\n`
    }
    
    text += `\n🔗 amanai.kz`
    
    return text
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(getReportText())
    const url = `https://wa.me/?text=${text}`
    window.open(url, "_blank")
    setIsOpen(false)
  }

  const handleEmailShare = async () => {
    setEmailLoading(true)
    
    try {
      const date = new Date(reportData.createdAt).toLocaleDateString("ru-RU")
      const subject = encodeURIComponent(`AMAN AI - Отчёт от ${date}`)
      
      let body = getReportText()
      
      if (reportType === "consultation") {
        try {
          const pdfData: ConsultationReportData = {
            patientName: reportData.patientName,
            recordingDuration: reportData.recordingDuration,
            generalCondition: reportData.generalCondition,
            dialogueProtocol: reportData.dialogueProtocol,
            recommendations: reportData.recommendations,
            conclusion: reportData.conclusion,
            createdAt: reportData.createdAt,
          }
          
          const blob = await generateConsultationPdf(pdfData, { brandName: "AMAN AI" })
          
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `AMAN_AI_Report_${date.replace(/\./g, "-")}.pdf`
          link.click()
          URL.revokeObjectURL(url)
          
          body += "\n\n📎 PDF файл скачан — прикрепите его к письму."
        } catch (err) {
          console.error("PDF generation failed:", err)
        }
      }
      
      const mailtoUrl = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`
      window.location.href = mailtoUrl
      
    } finally {
      setEmailLoading(false)
      setIsOpen(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      const text = getReportText()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement("textarea")
      textArea.value = getReportText()
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setIsOpen(false)
  }

  const dropdown = isOpen && typeof document !== "undefined" ? createPortal(
    <div 
      ref={dropdownRef}
      className="fixed w-56 bg-background/95 backdrop-blur-sm rounded-xl border shadow-xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
    >
      <div className="p-1">
        {/* WhatsApp */}
        <button
          onClick={handleWhatsAppShare}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-500/10 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium">WhatsApp</p>
            <p className="text-xs text-muted-foreground">Хабарламамен жіберу</p>
          </div>
        </button>

        {/* Email */}
        <button
          onClick={handleEmailShare}
          disabled={emailLoading}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-500/10 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            {emailLoading ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Email</p>
            <p className="text-xs text-muted-foreground">
              {reportType === "consultation" ? "PDF қоса жіберу" : "Поштаға жіберу"}
            </p>
          </div>
        </button>

        {/* Copy */}
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-purple-500/10 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Link2 className="w-4 h-4 text-purple-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {copied ? "Көшірілді!" : "Көшіру"}
            </p>
            <p className="text-xs text-muted-foreground">
              {copied ? "Скопировано!" : "Мәтінді көшіру"}
            </p>
          </div>
        </button>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl transition-colors font-medium",
          "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title="Бөлісу / Поделиться"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Бөлісу</span>
      </button>
      {dropdown}
    </>
  )
}
