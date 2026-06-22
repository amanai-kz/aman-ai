import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { assertNullablePatientAccess } from "@/lib/authz"
import { PrivilegedApiError, toErrorResponse } from "@/lib/privileged-api"
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

    // Object-level authorization: only ADMIN, the owning PATIENT, or an assigned
    // DOCTOR may read this report (prevents IDOR by arbitrary report id).
    await assertNullablePatientAccess(session, result.rows[0].patientId)

    return NextResponse.json({ report: result.rows[0] })
  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
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

    // Load ownership before deleting — without this any authenticated user could
    // delete any patient's consultation report by id (IDOR).
    const existing = await pool.query(
      `SELECT patient_id as "patientId" FROM consultation_reports WHERE id = $1`,
      [id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    await assertNullablePatientAccess(session, existing.rows[0].patientId)

    await pool.query(`DELETE FROM consultation_reports WHERE id = $1`, [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
    console.error("Error deleting consultation report:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}
