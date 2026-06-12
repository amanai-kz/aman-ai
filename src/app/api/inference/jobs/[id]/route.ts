import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getInferenceJobResponse } from "@/lib/inference"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await getInferenceJobResponse(db, await auth(), id)
  return NextResponse.json(response.body, { status: response.status })
}
