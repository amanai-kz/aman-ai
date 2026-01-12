import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { patient: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      email: user.email,
      phone: user.patient?.phone || null,
      name: user.name,
    })
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}












