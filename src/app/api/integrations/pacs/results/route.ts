import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { createSiteConfigStore } from "@/lib/site-config"
import { db } from "@/lib/db"
import { createDicomResultExportResponse } from "@/lib/dicom-result-export"

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

  const response = await createDicomResultExportResponse(
    db,
    await auth(),
    body,
    createSiteConfigStore()
  )

  return NextResponse.json(response.body, { status: response.status })
}
