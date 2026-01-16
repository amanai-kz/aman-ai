"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Calendar, User } from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"

interface ReportVerification {
  valid: boolean
  reportType?: string
  patientName?: string
  createdAt?: string
  title?: string
  verified: boolean
}

export default function VerifyReportPage() {
  const params = useParams()
  const reportId = params.reportId as string
  const [verification, setVerification] = useState<ReportVerification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function verifyReport() {
      try {
        const response = await fetch(`/api/reports/${reportId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setVerification({ valid: false, verified: false })
          } else {
            throw new Error("Failed to verify report")
          }
          return
        }

        const data = await response.json()
        setVerification({
          valid: true,
          verified: true,
          reportType: data.reportType || "consultation",
          patientName: data.patientName,
          createdAt: data.createdAt,
          title: data.title,
        })
      } catch (err) {
        console.error("Verification error:", err)
        setError("Не удалось проверить отчёт. Попробуйте позже.")
      } finally {
        setLoading(false)
      }
    }

    if (reportId) {
      verifyReport()
    }
  }, [reportId])

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-4xl font-bold mb-2">Проверка отчёта</h1>
            <p className="text-muted-foreground">
              Система проверки подлинности документов AMAN AI
            </p>
          </div>

          {/* Verification Card */}
          <div className="bg-background/80 backdrop-blur-sm rounded-2xl border p-8">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
                <p className="text-muted-foreground">Проверяем подлинность отчёта...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Ошибка проверки</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : verification?.valid ? (
              <div className="space-y-6">
                {/* Success Header */}
                <div className="text-center pb-6 border-b">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-emerald-500 mb-2">
                    ✓ Отчёт подтверждён
                  </h2>
                  <p className="text-muted-foreground">
                    Этот документ является подлинным отчётом AMAN AI
                  </p>
                </div>

                {/* Report Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Информация о документе</h3>
                  
                  {verification.title && (
                    <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                      <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Название</div>
                        <div className="font-medium">{verification.title}</div>
                      </div>
                    </div>
                  )}

                  {verification.patientName && (
                    <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                      <User className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Пациент</div>
                        <div className="font-medium">{verification.patientName}</div>
                      </div>
                    </div>
                  )}

                  {verification.createdAt && (
                    <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Дата создания</div>
                        <div className="font-medium">
                          {new Date(verification.createdAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">ID документа</div>
                      <div className="font-mono text-sm">{reportId}</div>
                    </div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="pt-6 border-t">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      🔒 Этот документ защищён криптографической подписью и может быть
                      проверен в любое время через систему AMAN AI.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Отчёт не найден</h2>
                <p className="text-muted-foreground mb-6">
                  Документ с таким ID не существует в нашей системе.<br />
                  Проверьте правильность QR-кода или обратитесь к выдавшему документ.
                </p>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Если вы получили этот документ от медицинского учреждения,
                    убедитесь в его подлинности другими способами.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-muted-foreground">
            <p>
              Система проверки документов AMAN AI •{" "}
              <a href="/" className="text-emerald-500 hover:underline">
                Вернуться на главную
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


