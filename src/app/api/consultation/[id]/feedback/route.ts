import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { assertNullablePatientAccess } from "@/lib/authz"
import { PrivilegedApiError, toErrorResponse } from "@/lib/privileged-api"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// POST - Submit feedback for a consultation report
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { rating, feedbackText, feedbackCategories } = body

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    // Check the report exists and that the caller owns / is assigned to it
    // (otherwise any authenticated user could rate any patient's report).
    const existingReport = await pool.query(
      `SELECT patient_id as "patientId" FROM consultation_reports WHERE id = $1`,
      [id]
    )

    if (existingReport.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    await assertNullablePatientAccess(session, existingReport.rows[0].patientId)

    // Update the report with feedback
    const result = await pool.query(
      `UPDATE consultation_reports
       SET
         rating = $1,
         feedback_text = $2,
         feedback_categories = $3,
         feedback_submitted_at = NOW()
       WHERE id = $4
       RETURNING
         id,
         rating,
         feedback_text as "feedbackText",
         feedback_categories as "feedbackCategories",
         feedback_submitted_at as "feedbackSubmittedAt"`,
      [
        rating,
        feedbackText || null,
        feedbackCategories || [],
        id
      ]
    )

    return NextResponse.json({
      success: true,
      feedback: result.rows[0]
    })

  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
    console.error("Error submitting consultation feedback:", error)
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}

// GET - Get feedback for a consultation report
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
        patient_id as "patientId",
        rating,
        feedback_text as "feedbackText",
        feedback_categories as "feedbackCategories",
        feedback_submitted_at as "feedbackSubmittedAt"
       FROM consultation_reports
       WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    await assertNullablePatientAccess(session, result.rows[0].patientId)

    const feedback = result.rows[0]

    return NextResponse.json({
      hasFeedback: !!feedback.feedbackSubmittedAt,
      feedback: feedback.feedbackSubmittedAt ? feedback : null
    })

  } catch (error) {
    if (error instanceof PrivilegedApiError) {
      const { status, body } = toErrorResponse(error)
      return NextResponse.json(body, { status })
    }
    console.error("Error fetching consultation feedback:", error)
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 })
  }
}
