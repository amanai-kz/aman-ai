"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Share2, MessageCircle, Mail, Link2, Check, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
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
  const [loading, setLoading] = useState<"whatsapp" | "email" | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
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
      const dropdownWidth = 300
      let left = rect.right - dropdownWidth
      
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
        setSuccess("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

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

  const generatePdfBase64 = async (): Promise<string | null> => {
    if (reportType !== "consultation") return null
    
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
      
      // Convert blob to base64
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          // Remove data URL prefix
          resolve(base64.split(",")[1])
        }
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      console.error("PDF generation failed:", err)
      return null
    }
  }

  const handleSend = async (type: "whatsapp" | "email") => {
    setError("")
    setSuccess("")
    setLoading(type)
    
    try {
      // Generate PDF for consultation reports
      const pdfBase64 = await generatePdfBase64()
      
      const response = await fetch("/api/share/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          reportType,
          reportId: reportData.id,
          pdfBase64,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.needsPhone) {
          setError("Укажите телефон в профиле")
        } else if (data.needsEmail) {
          setError("Email не указан")
        } else if (data.notConfigured) {
          // Fallback to manual sharing
          if (type === "whatsapp") {
            handleWhatsAppFallback()
          } else {
            handleEmailFallback()
          }
          return
        } else {
          setError(data.error || "Ошибка отправки")
        }
        return
      }

      setSuccess(data.message || "Отправлено!")
      
    } catch (err) {
      console.error("Send error:", err)
      setError("Ошибка соединения")
    } finally {
      setLoading(null)
    }
  }

  const handleWhatsAppFallback = () => {
    if (!contacts?.phone) {
      setError("Телефон не указан в профиле")
      return
    }
    
    const phone = contacts.phone.replace(/\D/g, "")
    const text = getReportText()
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
    setIsOpen(false)
  }

  const handleEmailFallback = () => {
    if (!contacts?.email) {
      setError("Email не указан")
      return
    }
    
    const date = new Date(reportData.createdAt).toLocaleDateString("ru-RU")
    const subject = encodeURIComponent(`AMAN AI - Отчёт от ${date}`)
    const body = encodeURIComponent(getReportText())
    window.location.href = `mailto:${contacts.email}?subject=${subject}&body=${body}`
    setIsOpen(false)
  }

  const getReportText = () => {
    const date = new Date(reportData.createdAt).toLocaleDateString("ru-RU")
    const summary = reportData.conclusion || reportData.summary || ""
    const recommendations = reportData.recommendations || ""
    
    let text = `🏥 AMAN AI - Отчёт от ${date}\n\n`
    if (summary) text += `📋 Заключение:\n${summary}\n\n`
    if (recommendations) text += `💡 Рекомендации:\n${recommendations}\n\n`
    text += `🔗 amanai.kz`
    
    return text
  }

  const handleCopyLink = async () => {
    setError("")
    try {
      await navigator.clipboard.writeText(getReportText())
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
      className="fixed bg-background/95 backdrop-blur-sm rounded-xl border shadow-xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: 300 }}
    >
      <div className="p-2">
        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-emerald-500/10 rounded-lg text-emerald-500 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 mb-2 bg-red-500/10 rounded-lg text-red-500 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* WhatsApp */}
        <button
          onClick={() => handleSend("whatsapp")}
          disabled={loading !== null}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-emerald-500/10 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            {loading === "whatsapp" ? (
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            ) : (
              <MessageCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              {contacts?.phone || "Телефон не указан"}
            </p>
          </div>
        </button>

        {/* Email */}
        <button
          onClick={() => handleSend("email")}
          disabled={loading !== null}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-blue-500/10 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            {loading === "email" ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : (
              <Mail className="w-5 h-5 text-blue-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">Email</p>
            <p className="text-xs text-muted-foreground truncate">
              {contacts?.email || "Email не указан"}
            </p>
          </div>
        </button>

        {/* Copy */}
        <button
          onClick={handleCopyLink}
          disabled={loading !== null}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-purple-500/10 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            {copied ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <Link2 className="w-5 h-5 text-purple-500" />
            )}
          </div>
          <div>
            <p className="font-medium">{copied ? "Скопировано!" : "Копировать текст"}</p>
            <p className="text-xs text-muted-foreground">В буфер обмена</p>
          </div>
        </button>
      </div>

      {/* Hint */}
      {(!contacts?.phone) && (
        <div className="px-3 py-2 border-t text-xs text-muted-foreground text-center bg-muted/30">
          <a href="/dashboard/profile" className="text-blue-500 hover:underline">
            Добавьте телефон в профиле →
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
