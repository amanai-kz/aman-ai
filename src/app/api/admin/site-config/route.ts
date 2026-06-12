import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { createSiteConfigStore, getSiteConfigResponse, updateSiteConfigResponse } from "@/lib/site-config"

export async function GET() {
  const response = await getSiteConfigResponse(createSiteConfigStore(), await auth())
  return NextResponse.json(response.body, { status: response.status })
}

export async function PATCH(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", errorKey: "INVALID_BODY" },
      { status: 400 }
    )
  }

  const response = await updateSiteConfigResponse(createSiteConfigStore(), await auth(), body)
  return NextResponse.json(response.body, { status: response.status })
}
