import { auth } from "@/lib/auth"
import { assertAllowedPdfRecipient, getRouteSession } from "@/lib/security-scrum-62"
import { PrivilegedApiError, toErrorResponse } from "@/lib/privileged-api"
import { NextRequest, NextResponse } from "next/server"

async function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null
  const { Resend } = await import("resend")
  return new Resend(process.env.RESEND_API_KEY)
}

interface SendPdfEmailRequest {
  recipientEmail: string
  pdfBase64: string
  reportTitle: string
  patientName?: string
  reportType?: "consultation" | "blood" | "general"
}

export async function POST(request: NextRequest) {
  try {
    const session = await getRouteSession(auth)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: SendPdfEmailRequest = await request.json()
    const { recipientEmail, pdfBase64, reportTitle, patientName, reportType = "general" } = body

    if (!recipientEmail || !pdfBase64) {
      return NextResponse.json(
        { error: "Email and PDF data are required" },
        { status: 400 }
      )
    }
    assertAllowedPdfRecipient(session, recipientEmail)

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const resend = await getResendClient()
    if (!resend) {
      return NextResponse.json(
        {
          error: "Email service not configured. Please contact administrator.",
          notConfigured: true,
        },
        { status: 503 }
      )
    }

    try {
      const date = new Date().toLocaleDateString("ru-RU")
      const reportTypeText =
        reportType === "consultation"
          ? "Отчёт по консультации"
          : reportType === "blood"
          ? "Результаты анализа крови"
          : "Медицинский отчёт"

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 28px; }
              .header p { margin: 10px 0 0; opacity: 0.9; }
              .content { background: #f9fafb; padding: 25px; border-radius: 12px; margin-bottom: 20px; }
              .content h2 { color: #1f2937; margin-top: 0; }
              .info-row { margin: 12px 0; }
              .label { color: #6b7280; font-size: 14px; }
              .value { color: #1f2937; font-size: 16px; font-weight: 500; }
              .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 14px; }
              .footer a { color: #10b981; text-decoration: none; }
              .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏥 AMAN AI</h1>
                <p>${reportTypeText}</p>
              </div>
              
              <div class="content">
                <h2>${reportTitle}</h2>
                
                ${
                  patientName
                    ? `
                <div class="info-row">
                  <div class="label">Пациент</div>
                  <div class="value">${patientName}</div>
                </div>
                `
                    : ""
                }
                
                <div class="info-row">
                  <div class="label">Дата создания</div>
                  <div class="value">${date}</div>
                </div>
                
                <div class="info-row">
                  <div class="label">Статус</div>
                  <div class="value"><span class="badge">✓ Готов</span></div>
                </div>
              </div>
              
              <div style="background: white; padding: 25px; border-radius: 12px; border: 2px solid #e5e7eb; margin-bottom: 20px;">
                <p style="margin: 0; color: #1f2937; line-height: 1.6;">
                  📎 <strong>Прикреплен PDF-документ</strong><br>
                  Вы можете открыть прикрепленный файл для просмотра полного отчета.
                </p>
              </div>
              
              <div class="footer">
                <p style="margin: 10px 0;">
                  Этот отчёт создан с помощью искусственного интеллекта AMAN AI.<br>
                  Для полной диагностики обратитесь к врачу.
                </p>
                <p style="margin: 20px 0;">
                  <a href="https://amanai.kz">amanai.kz</a> • 
                  <a href="https://amanai.kz/privacy">Политика конфиденциальности</a>
                </p>
                <p style="color: #d1d5db; font-size: 12px;">
                  © ${new Date().getFullYear()} AMAN AI. Все права защищены.
                </p>
              </div>
            </div>
          </body>
        </html>
      `

      await resend.emails.send({
        from: "AMAN AI <noreply@amanai.kz>",
        to: recipientEmail,
        subject: `AMAN AI - ${reportTypeText} от ${date}`,
        html: emailHtml,
        attachments: [
          {
            filename: `AMAN_AI_${reportType}_${date.replace(/\./g, "-")}.pdf`,
            content: pdfBase64,
          },
        ],
      })

      return NextResponse.json({
        success: true,
        message: `PDF успешно отправлен на ${recipientEmail}`,
      })
    } catch (resendError: unknown) {
      console.error("Resend error:", resendError)
      const errorMessage =
        resendError instanceof Error ? resendError.message : "Unknown error"
      return NextResponse.json(
        { error: `Email sending failed: ${errorMessage}` },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
    console.error("Error sending PDF email:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
