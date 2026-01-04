import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// Twilio client
let twilioClient: ReturnType<typeof import("twilio")> | null = null

async function getTwilioClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = (await import("twilio")).default
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return twilioClient
}

// Resend client
async function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null
  const { Resend } = await import("resend")
  return new Resend(process.env.RESEND_API_KEY)
}

interface SendRequest {
  type: "whatsapp" | "email"
  reportType: "consultation" | "voice"
  reportId: string
  pdfBase64?: string // Base64 encoded PDF
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: SendRequest = await request.json()
    const { type, reportType, reportId, pdfBase64 } = body

    // Get user contacts
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { patient: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const phone = user.patient?.phone || user.patient?.phoneNumber
    const email = user.email

    // Get report data
    let reportData: { title: string; summary: string; date: string } | null = null

    if (reportType === "consultation") {
      const report = await db.consultationReport.findUnique({ where: { id: reportId } })
      if (report) {
        reportData = {
          title: report.title,
          summary: report.conclusion || report.generalCondition || "Консультация",
          date: report.createdAt.toLocaleDateString("ru-RU"),
        }
      }
    } else {
      const report = await db.voiceReport.findUnique({ where: { id: reportId } })
      if (report) {
        reportData = {
          title: report.title,
          summary: report.summary,
          date: report.createdAt.toLocaleDateString("ru-RU"),
        }
      }
    }

    if (!reportData) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Send via WhatsApp
    if (type === "whatsapp") {
      if (!phone) {
        return NextResponse.json({ 
          error: "Телефон не указан в профиле",
          needsPhone: true 
        }, { status: 400 })
      }

      const twilio = await getTwilioClient()
      if (!twilio) {
        return NextResponse.json({ 
          error: "WhatsApp сервис не настроен. Обратитесь к администратору.",
          notConfigured: true 
        }, { status: 503 })
      }

      // Format phone for WhatsApp
      let formattedPhone = phone.replace(/\D/g, "")
      if (formattedPhone.startsWith("8")) {
        formattedPhone = "7" + formattedPhone.slice(1)
      }
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone
      }

      const messageBody = `🏥 *AMAN AI - Отчёт*\n\n📅 ${reportData.date}\n\n📋 *${reportData.title}*\n\n${reportData.summary}\n\n---\n🔗 amanai.kz`

      try {
        // Send text message
        await twilio.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
          to: `whatsapp:${formattedPhone}`,
          body: messageBody,
        })

        // If PDF provided, send as media
        if (pdfBase64) {
          // Twilio requires a public URL for media, so we'd need to upload to S3/Cloudinary first
          // For now, we'll note this limitation
          // TODO: Implement PDF hosting and send as media URL
        }

        return NextResponse.json({ 
          success: true, 
          message: "Отправлено в WhatsApp" 
        })

      } catch (twilioError: unknown) {
        console.error("Twilio error:", twilioError)
        const errorMessage = twilioError instanceof Error ? twilioError.message : "Unknown error"
        return NextResponse.json({ 
          error: `Ошибка отправки в WhatsApp: ${errorMessage}` 
        }, { status: 500 })
      }
    }

    // Send via Email
    if (type === "email") {
      if (!email) {
        return NextResponse.json({ 
          error: "Email не указан",
          needsEmail: true 
        }, { status: 400 })
      }

      const resend = await getResendClient()
      if (!resend) {
        return NextResponse.json({ 
          error: "Email сервис не настроен. Обратитесь к администратору.",
          notConfigured: true 
        }, { status: 503 })
      }

      try {
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10b981;">🏥 AMAN AI</h1>
            <p style="color: #666;">Отчёт от ${reportData.date}</p>
            <hr style="border: 1px solid #eee;">
            <h2>${reportData.title}</h2>
            <p style="line-height: 1.6;">${reportData.summary}</p>
            <hr style="border: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              Этот отчёт создан с помощью AI. Для полной диагностики обратитесь к врачу.
            </p>
            <p style="color: #10b981;"><a href="https://amanai.kz">amanai.kz</a></p>
          </div>
        `

        const attachments = pdfBase64 ? [{
          filename: `AMAN_AI_Report_${reportData.date.replace(/\./g, "-")}.pdf`,
          content: pdfBase64,
        }] : []

        await resend.emails.send({
          from: "AMAN AI <noreply@amanai.kz>",
          to: email,
          subject: `AMAN AI - Отчёт от ${reportData.date}`,
          html: emailHtml,
          attachments,
        })

        return NextResponse.json({ 
          success: true, 
          message: "Отправлено на email" 
        })

      } catch (resendError: unknown) {
        console.error("Resend error:", resendError)
        const errorMessage = resendError instanceof Error ? resendError.message : "Unknown error"
        return NextResponse.json({ 
          error: `Ошибка отправки email: ${errorMessage}` 
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })

  } catch (error) {
    console.error("Error sending report:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}









