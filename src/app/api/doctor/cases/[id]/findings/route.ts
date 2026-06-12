import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getDoctorCaseFindingsResponse } from "@/lib/doctor-api"
import { db } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await getDoctorCaseFindingsResponse(db, await auth(), id)
  return NextResponse.json(response.body, { status: response.status })
}
