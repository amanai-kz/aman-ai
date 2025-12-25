"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Share2, MessageCircle, Mail, Link2, Check, Loader2, AlertCircle } from "lucide-react"
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

interface UserContacts {
  email: string | null
  phone: string | null
  name: string | null
}

export function ShareReport({ reportType, reportData, disabled }: ShareReportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [contacts, setContacts] = useState<UserContacts | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch user contacts when dropdown opens
  useEffect(() => {
    if (isOpen && !contacts) {
      fetchContacts()
    }
  }, [isOpen, contacts])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 280
      let left = rect.right - dropdownWidth
      
      // Ensure dropdown doesn't go off-screen
      if (left < 10) left = 10
      
      setDropdownPosition({
        top: rect.bottom + 8,
        left: left,
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
        setError("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/user/contacts")
      if (res.ok) {
        const data = await res.json()
        setContacts(data)
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err)
    }
  }

  const formatPhone = (phone: string): string => {
    // Remove all non-digits
    return phone.replace(/\D/g, "")
  }

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

  const handleWhatsAppShare = async () => {
    setError("")
    
    if (!contacts?.phone) {
      setError("Телефон не указан в профиле. Добавьте номер в настройках.")
      return
    }

    setLoading(true)
    
    try {
      const phone = formatPhone(contacts.phone)
      const text = encodeURIComponent(getReportText())
      
      // For consultation reports, also generate and download PDF
      if (reportType === "consultation") {
        try {
          const date = new Date(reportData.createdAt).toLocaleDateString("ru-RU")
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
        } catch (err) {
          console.error("PDF generation failed:", err)
        }
      }
      
      // Open WhatsApp with the phone number
      const waUrl = `https://wa.me/${phone}?text=${text}`
      window.open(waUrl, "_blank")
      setIsOpen(false)
      
    } catch (err) {
      setError("Не удалось открыть WhatsApp")
    } finally {
      setLoading(false)
    }
  }

  const handleEmailShare = async () => {
    setError("")
    
    if (!contacts?.email) {
      setError("Email не найден. Проверьте профиль.")
      return
    }

    setLoading(true)
    
    try {
      const date = new Date(reportData.createdAt).toLocaleDateString("ru-RU")
      const subject = encodeURIComponent(`AMAN AI - Отчёт от ${date}`)
      let body = getReportText()
      
      // For consultation reports, generate PDF
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
      
      // Open email client
      const mailtoUrl = `mailto:${contacts.email}?subject=${subject}&body=${encodeURIComponent(body)}`
      window.location.href = mailtoUrl
      setIsOpen(false)
      
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    setError("")
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
      className="fixed w-70 bg-background/95 backdrop-blur-sm rounded-xl border shadow-xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: 280 }}
    >
      <div className="p-1">
        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 mb-1 bg-red-500/10 rounded-lg text-red-500 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* WhatsApp */}
        <button
          onClick={handleWhatsAppShare}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-500/10 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              {contacts?.phone || "Телефон не указан"}
            </p>
          </div>
        </button>

        {/* Email */}
        <button
          onClick={handleEmailShare}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-500/10 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Email</p>
            <p className="text-xs text-muted-foreground truncate">
              {contacts?.email || "Email не указан"}
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

      {/* Hint */}
      {(!contacts?.phone || !contacts?.email) && (
        <div className="px-3 py-2 border-t text-xs text-muted-foreground text-center">
          <a href="/dashboard/profile" className="text-blue-500 hover:underline">
            Добавьте контакты в профиле →
          </a>
        </div>
      )}
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
