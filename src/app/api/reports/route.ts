import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { Pool } from "pg"

// Direct PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// GET all voice reports
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        vapi_call_id as "vapiCallId",
        call_duration as "callDuration",
        patient_id as "patientId",
        patient_name as "patientName",
        title,
        summary,
        general_wellbeing as "generalWellbeing",
        sleep_quality as "sleepQuality",
        mood_state as "moodState",
        stress_level as "stressLevel",
        risk_level as "riskLevel",
        requires_followup as "requiresFollowup",
        urgent_attention as "urgentAttention",
        created_at as "createdAt"
      FROM voice_reports
      ORDER BY created_at DESC
    `)
    
    return NextResponse.json({ reports: result.rows })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}
