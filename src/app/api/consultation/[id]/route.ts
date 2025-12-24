import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// GET single consultation report
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const result = await pool.query(
      `SELECT 
        id,
        patient_id as "patientId",
        patient_name as "patientName",
        recording_duration as "recordingDuration",
        title,
        general_condition as "generalCondition",
        sleep,
        mood,
        stress,
        physical_symptoms as "physicalSymptoms",
        conclusion,
        recommendations,
        raw_dialogue as "rawDialogue",
        created_at as "createdAt"
      FROM consultation_reports
      WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    return NextResponse.json({ report: result.rows[0] })
  } catch (error) {
    console.error("Error fetching consultation report:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}

// DELETE consultation report
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    await pool.query(
      `DELETE FROM consultation_reports WHERE id = $1`,
      [id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting consultation report:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}




