import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getDicomResultExportPreviewResponse } from "@/lib/dicom-result-export"
import { createSiteConfigStore } from "@/lib/site-config"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await getDicomResultExportPreviewResponse(
    db,
    await auth(),
    id,
    createSiteConfigStore()
  )

  return NextResponse.json(response.body, { status: response.status })
}
