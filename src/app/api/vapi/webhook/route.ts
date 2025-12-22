import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import OpenAI from "openai"
import { randomUUID } from "crypto"

const GROQ_API_KEY = process.env.GROQ_API_KEY || ""

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

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
      metadata?: {
        userId?: string
        userName?: string
        userEmail?: string
      }
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
        generalWellbeing: null as number | null,
        sleepQuality: null as string | null,
        sleepHours: null as number | null,
        moodState: null as string | null,
        stressLevel: null as string | null,
        stressSources: [] as string[],
        physicalSymptoms: [] as string[],
        cognitiveIssues: [] as string[],
        socialConnections: null as string | null,
        riskLevel: "LOW",
        requiresFollowup: false,
        urgentAttention: false,
        insights: [] as string[],
        recommendations: [] as string[]
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
      
      // Extract patient info from metadata
      const patientId = call.metadata?.userId || null
      const patientName = call.metadata?.userName || "Анонимный пациент"
      
      // Create report in database using raw SQL
      const reportId = randomUUID()
      await pool.query(`
        INSERT INTO voice_reports (
          id, vapi_call_id, call_duration, patient_id, patient_name, title, summary,
          general_wellbeing, sleep_quality, sleep_hours, mood_state,
          stress_level, stress_sources, physical_symptoms, cognitive_issues,
          social_connections, risk_level, ai_insights, recommendations,
          requires_followup, urgent_attention, language, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW()
        )
      `, [
        reportId,
        call.id,
        callDuration,
        patientId,
        patientName,
        `Денсаулық есебі - ${patientName} - ${new Date().toLocaleDateString("kk-KZ")}`,
        reportText,
        structuredData.generalWellbeing,
        structuredData.sleepQuality,
        structuredData.sleepHours,
        structuredData.moodState,
        structuredData.stressLevel,
        structuredData.stressSources,
        structuredData.physicalSymptoms,
        structuredData.cognitiveIssues,
        structuredData.socialConnections,
        structuredData.riskLevel,
        structuredData.insights,
        structuredData.recommendations,
        structuredData.requiresFollowup,
        structuredData.urgentAttention,
        "kk"
      ])
      
      console.log("Report created:", reportId)
      
      return NextResponse.json({ 
        status: "success", 
        reportId 
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
