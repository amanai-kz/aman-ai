import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getDoctorCasesResponse } from "@/lib/doctor-api"
import { db } from "@/lib/db"

export async function GET() {
  const response = await getDoctorCasesResponse(db, await auth())
  return NextResponse.json(response.body, { status: response.status })
}
