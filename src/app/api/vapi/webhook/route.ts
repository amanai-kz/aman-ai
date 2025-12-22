import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const GROQ_API_KEY = process.env.GROQ_API_KEY || ""

// Groq client for report generation
const groq = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
})

// System prompt for generating medical report from conversation
const REPORT_SYSTEM_PROMPT = `Сен медициналық есеп жасаушы AI-сің. Пациентпен сөйлесу логынан ресми медициналық есеп жаса.

Есеп құрылымы:
1. ЖАЛПЫ ЖАҒДАЙ / ОБЩЕЕ СОСТОЯНИЕ - краткое резюме
2. ҰЙҚЫ / СОН - качество и продолжительность
3. КӨҢІЛ-КҮЙ / НАСТРОЕНИЕ - эмоциональное состояние
4. СТРЕСС ДЕҢГЕЙІ / УРОВЕНЬ СТРЕССА - оценка и источники
5. ФИЗИКАЛЫҚ СИМПТОМДАР / ФИЗИЧЕСКИЕ СИМПТОМЫ - жалобы
6. КОГНИТИВТІ ФУНКЦИЯЛАР / КОГНИТИВНЫЕ ФУНКЦИИ - память, внимание
7. ӘЛЕУМЕТТІК БАЙЛАНЫСТАР / СОЦИАЛЬНЫЕ СВЯЗИ - общение
8. ҚОРЫТЫНДЫ / ЗАКЛЮЧЕНИЕ - общая оценка
9. ҰСЫНЫСТАР / РЕКОМЕНДАЦИИ - что делать

Также извлеки структурированные данные в JSON:
{
  "generalWellbeing": 1-10,
  "sleepQuality": "жақсы/орташа/нашар",
  "sleepHours": number,
  "moodState": "көңілді/бейтарап/мұңды/мазасыз",
  "stressLevel": "төмен/орташа/жоғары",
  "stressSources": ["жұмыс", "отбасы", etc.],
  "physicalSymptoms": ["бас ауруы", etc.],
  "cognitiveIssues": ["концентрация", etc.],
  "socialConnections": "жиі/сирек/жоқ",
  "riskLevel": "LOW/MODERATE/HIGH/CRITICAL",
  "requiresFollowup": boolean,
  "urgentAttention": boolean,
  "insights": ["insight1", "insight2"],
  "recommendations": ["rec1", "rec2"]
}

Жауапты екі бөлікке бөл:
---REPORT---
[Толық есеп мәтіні / Полный текст отчёта]
---JSON---
{structured data}

Есеп қазақша және орысша болсын (билингвальный).`

interface VapiMessage {
  role: "user" | "assistant" | "system"
  message?: string
  content?: string
}

interface VapiWebhookPayload {
  message: {
    type: string
    call?: {
      id: string
      type: string
      status: string
      startedAt?: string
      endedAt?: string
    }
    artifact?: {
      messages?: VapiMessage[]
      transcript?: string
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload: VapiWebhookPayload = await req.json()
    
    console.log("VAPI Webhook received:", JSON.stringify(payload, null, 2))
    
    // Handle end-of-call-report
    if (payload.message?.type === "end-of-call-report") {
      const call = payload.message.call
      const artifact = payload.message.artifact
      
      if (!call?.id) {
        console.log("No call ID in webhook")
        return NextResponse.json({ status: "ignored" })
      }
      
      // Extract transcript from messages
      const messages = artifact?.messages || []
      const transcript = messages
        .filter((m: VapiMessage) => m.role === "user" || m.role === "assistant")
        .map((m: VapiMessage) => `${m.role === "user" ? "Пациент" : "AI"}: ${m.message || m.content || ""}`)
        .join("\n")
      
      if (!transcript || transcript.length < 50) {
        console.log("Transcript too short, skipping report generation")
        return NextResponse.json({ status: "skipped", reason: "short_transcript" })
      }
      
      console.log("Generating report from transcript...")
      
      // Generate report using Groq
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: REPORT_SYSTEM_PROMPT },
          { role: "user", content: `Мына сөйлесуден есеп жаса:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      })
      
      const aiResponse = completion.choices[0]?.message?.content || ""
      
      // Parse response
      const reportMatch = aiResponse.match(/---REPORT---([\s\S]*?)---JSON---/)
      const jsonMatch = aiResponse.match(/---JSON---([\s\S]*)/)
      
      const reportText = reportMatch?.[1]?.trim() || aiResponse
      let structuredData = {
        generalWellbeing: null,
        sleepQuality: null,
        sleepHours: null,
        moodState: null,
        stressLevel: null,
        stressSources: [],
        physicalSymptoms: [],
        cognitiveIssues: [],
        socialConnections: null,
        riskLevel: "LOW",
        requiresFollowup: false,
        urgentAttention: false,
        insights: [],
        recommendations: []
      }
      
      if (jsonMatch?.[1]) {
        try {
          structuredData = { ...structuredData, ...JSON.parse(jsonMatch[1].trim()) }
        } catch (e) {
          console.error("Failed to parse structured data:", e)
        }
      }
      
      // Calculate call duration
      let callDuration = null
      if (call.startedAt && call.endedAt) {
        callDuration = Math.round(
          (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
        )
      }
      
      // Create report in database
      const report = await prisma.voiceReport.create({
        data: {
          vapiCallId: call.id,
          callDuration,
          title: `Денсаулық есебі / Отчёт здоровья - ${new Date().toLocaleDateString("kk-KZ")}`,
          summary: reportText,
          generalWellbeing: structuredData.generalWellbeing,
          sleepQuality: structuredData.sleepQuality,
          sleepHours: structuredData.sleepHours,
          moodState: structuredData.moodState,
          stressLevel: structuredData.stressLevel,
          stressSources: structuredData.stressSources,
          physicalSymptoms: structuredData.physicalSymptoms,
          cognitiveIssues: structuredData.cognitiveIssues,
          socialConnections: structuredData.socialConnections,
          riskLevel: structuredData.riskLevel,
          aiInsights: structuredData.insights,
          recommendations: structuredData.recommendations,
          requiresFollowup: structuredData.requiresFollowup,
          urgentAttention: structuredData.urgentAttention,
          language: "kk",
        }
      })
      
      console.log("Report created:", report.id)
      
      return NextResponse.json({ 
        status: "success", 
        reportId: report.id 
      })
    }
    
    // Handle other webhook types
    return NextResponse.json({ status: "ignored", type: payload.message?.type })
    
  } catch (error) {
    console.error("VAPI Webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

// VAPI sends GET to verify webhook URL
export async function GET() {
  return NextResponse.json({ status: "ok", service: "AMAN AI VAPI Webhook" })
}

