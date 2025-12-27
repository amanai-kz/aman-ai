import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { Pool } from "pg"

// Direct PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// POST - Save consultation report
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { 
      result, 
      report,
      recordingDuration,
      patientName 
    } = body

    const payload = report || result

    if (!payload) {
      return NextResponse.json({ error: "No result data provided" }, { status: 400 })
    }

    const generalCondition = payload.generalCondition ?? payload.general_condition ?? null
    const dialogueProtocol = payload.dialogueProtocol ?? payload.dialogue_protocol ?? payload.raw_dialogue ?? null
    const recommendations = payload.recommendations ?? null
    const conclusion = payload.conclusion ?? null

    // Get patient ID if user is a patient
    let patientId = null
    if (session.user.role === "PATIENT") {
      const patientResult = await pool.query(
        `SELECT id FROM patients WHERE "userId" = $1`,
        [session.user.id]
      )
      if (patientResult.rows.length > 0) {
        patientId = patientResult.rows[0].id
      }
    }

    // Generate title with current date
    const now = new Date()
    const title = `Консультация от ${now.toLocaleDateString("ru-RU", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric" 
    })}`

    // Insert consultation report
    const insertResult = await pool.query(
      `INSERT INTO consultation_reports (
        id,
        patient_id,
        patient_name,
        recording_duration,
        title,
        general_condition,
        conclusion,
        recommendations,
        raw_dialogue,
        created_at
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW()
      ) RETURNING id, title, created_at as "createdAt"`,
      [
        patientId,
        patientName || session.user.name || "Пациент",
        recordingDuration || null,
        title,
        generalCondition,
        conclusion,
        recommendations,
        dialogueProtocol
      ]
    )

    return NextResponse.json({ 
      success: true, 
      report: insertResult.rows[0] 
    })

  } catch (error) {
    console.error("Error saving consultation report:", error)
    return NextResponse.json({ error: "Failed to save report" }, { status: 500 })
  }
}

// GET - Get all consultation reports
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let query = `
      SELECT 
        id,
        patient_id as "patientId",
        patient_name as "patientName",
        recording_duration as "recordingDuration",
        title,
        general_condition as "generalCondition",
        conclusion,
        recommendations,
        raw_dialogue as "dialogueProtocol",
        created_at as "createdAt"
      FROM consultation_reports
    `
    
    const params: string[] = []
    
    // If patient, only show their reports
    if (session.user.role === "PATIENT") {
      const patientResult = await pool.query(
        `SELECT id FROM patients WHERE "userId" = $1`,
        [session.user.id]
      )
      if (patientResult.rows.length > 0) {
        query += ` WHERE patient_id = $1`
        params.push(patientResult.rows[0].id)
      } else {
        // No patient profile - return empty array
        return NextResponse.json({ reports: [] })
      }
    }
    
    query += ` ORDER BY created_at DESC`
    
    const result = await pool.query(query, params)
    
    return NextResponse.json({ reports: result.rows })
  } catch (error) {
    console.error("Error fetching consultation reports:", error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}

