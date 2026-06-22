import { NextRequest, NextResponse } from "next/server"
import { AnalysisStatus, Prisma, RiskLevel, ServiceType } from "@prisma/client"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { assertPatientAccess } from "@/lib/authz"
import { toErrorResponse } from "@/lib/privileged-api"

// MRI analyze + persist: runs the study through the ML engine (backend
// /services/ct-mri/analyze, Epic SCRUM-7) and stores the result as an Analysis
// so it lands on the radiologist worklist and flows into the existing
// AnalysisReview sign-off (decision D2 — assistive, never auto-final).

const BACKEND_URL = process.env.ML_BACKEND_URL ?? "http://localhost:8000"

type ScanAnalysisResult = {
  findings: string[]
  confidence: number
  risk_level: string
  recommendations: string[]
}

function mapRisk(level: string): RiskLevel {
  switch (level) {
    case "high":
      return RiskLevel.HIGH
    case "medium":
      return RiskLevel.MODERATE
    case "review": // model abstained -> uncertain, needs manual review
      return RiskLevel.MODERATE
    default:
      return RiskLevel.LOW
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get("file")
  const patientId = form.get("patientId")
  if (!(file instanceof File) || typeof patientId !== "string" || !patientId) {
    return NextResponse.json(
      { error: "file and patientId are required" },
      { status: 400 }
    )
  }

  // Authorize before doing any work: the caller (ADMIN, the patient's assigned
  // DOCTOR, or the PATIENT themselves) must be allowed to write an Analysis for
  // this patientId — otherwise anyone authenticated could forge findings onto
  // an arbitrary patient and inject them into the radiologist worklist.
  try {
    await assertPatientAccess(session, patientId)
  } catch (e) {
    const { status, body } = toErrorResponse(e)
    return NextResponse.json(body, { status })
  }

  // 1) Inference on the ML backend (real engine; see backend ct_mri.analyze).
  let result: ScanAnalysisResult
  try {
    const upstream = new FormData()
    upstream.append("file", file, file.name)
    const res = await fetch(`${BACKEND_URL}/api/v1/services/ct-mri/analyze`, {
      method: "POST",
      body: upstream,
    })
    if (!res.ok) {
      throw new Error(`backend responded ${res.status}`)
    }
    result = (await res.json()) as ScanAnalysisResult
  } catch (err) {
    return NextResponse.json(
      { error: `inference failed: ${String(err)}` },
      { status: 502 }
    )
  }

  // 2) Persist as an Analysis -> appears on the doctor worklist (db.analysis).
  const analysis = await db.analysis.create({
    data: {
      patientId,
      serviceType: ServiceType.CT_MRI,
      status: AnalysisStatus.COMPLETED,
      confidence: result.confidence ?? null,
      riskLevel: mapRisk(result.risk_level),
      findings: result.findings ?? [],
      result: result as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  })

  return NextResponse.json({ analysis }, { status: 201 })
}
