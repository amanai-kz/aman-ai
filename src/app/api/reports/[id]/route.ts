import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET single report by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { id } = await params
    
    const report = await prisma.voiceReport.findUnique({
      where: { id }
    })
    
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }
    
    return NextResponse.json({ report })
  } catch (error) {
    console.error("Error fetching report:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}

// DELETE report
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { id } = await params
    
    await prisma.voiceReport.delete({
      where: { id }
    })
    
    return NextResponse.json({ status: "deleted" })
  } catch (error) {
    console.error("Error deleting report:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}

