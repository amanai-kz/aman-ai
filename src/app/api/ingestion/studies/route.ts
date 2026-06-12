import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createStudyIngestionResponse } from "@/lib/ingestion"

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", errorKey: "INVALID_BODY" },
      { status: 400 }
    )
  }

  const response = await createStudyIngestionResponse(db, await auth(), body)
  return NextResponse.json(response.body, { status: response.status })
}
