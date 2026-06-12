import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { patchDoctorCaseReviewResponse } from "@/lib/doctor-api"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", errorKey: "INVALID_BODY" },
      { status: 400 }
    )
  }

  const response = await patchDoctorCaseReviewResponse(db, await auth(), id, body)
  return NextResponse.json(response.body, { status: response.status })
}
