import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { assertNullablePatientAccess } from "@/lib/authz"
import { PrivilegedApiError, toErrorResponse } from "@/lib/privileged-api"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// GET single report by ID
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
      `SELECT * FROM voice_reports WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Object-level authorization: prevent reading another patient's voice report
    // by arbitrary id (IDOR).
    await assertNullablePatientAccess(session, result.rows[0].patient_id)

    return NextResponse.json({ report: result.rows[0] })
  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
    console.error("Error fetching report:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}

// DELETE report
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

    // Load ownership before deleting — otherwise any authenticated user could
    // delete any patient's voice report by id (IDOR).
    const existing = await pool.query(
      `SELECT patient_id FROM voice_reports WHERE id = $1`,
      [id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    await assertNullablePatientAccess(session, existing.rows[0].patient_id)

    await pool.query(`DELETE FROM voice_reports WHERE id = $1`, [id])

    return NextResponse.json({ status: "deleted" })
  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
    console.error("Error deleting report:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}
