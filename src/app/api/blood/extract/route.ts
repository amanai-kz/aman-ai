import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Forward to backend API
    const backendFormData = new FormData()
    backendFormData.append("file", file)
    backendFormData.append("patient_id", session.user.id || "unknown")
    backendFormData.append("save_to_profile", formData.get("save_to_profile")?.toString() || "false")

    const response = await fetch(`${BACKEND_URL}/api/v1/blood/extract-nlp`, {
      method: "POST",
      body: backendFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Backend error:", errorText)
      return NextResponse.json(
        { error: "Failed to process blood analysis" },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
    
  } catch (error) {
    console.error("Blood extract error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

