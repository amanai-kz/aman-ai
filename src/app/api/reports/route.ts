import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET all voice reports
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const reports = await prisma.voiceReport.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        vapiCallId: true,
        callDuration: true,
        title: true,
        summary: true,
        generalWellbeing: true,
        sleepQuality: true,
        moodState: true,
        stressLevel: true,
        riskLevel: true,
        requiresFollowup: true,
        urgentAttention: true,
        createdAt: true,
      }
    })
    
    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}

