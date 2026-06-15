import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getClinicalReportExportPreviewResponse } from "@/lib/clinical-report-export"
import { db } from "@/lib/db"
import { createSiteConfigStore } from "@/lib/site-config"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await getClinicalReportExportPreviewResponse(
    db,
    await auth(),
    id,
    createSiteConfigStore()
  )

  return NextResponse.json(response.body, { status: response.status })
}
