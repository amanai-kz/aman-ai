import { NextRequest, NextResponse } from "next/server"
import { AnalysisStatus, Prisma, RiskLevel, ServiceType } from "@prisma/client"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { assertPatientAccess } from "@/lib/authz"
import { createBackendAccessToken } from "@/lib/backend-auth"
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
  processing_time_ms: number
  segmentation?: {
    mask_png_base64: string
    width: number
    height: number
    positive_pixel_count: number
    positive_area_fraction: number
    max_probability: number
    mean_positive_probability: number | null
    threshold: number
  }
}

const MAX_SLICE_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_NIFTI_UPLOAD_BYTES = 64 * 1024 * 1024

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

  const isNifti = /\.nii(\.gz)?$/i.test(file.name)
  const maxUploadBytes = isNifti ? MAX_NIFTI_UPLOAD_BYTES : MAX_SLICE_UPLOAD_BYTES
  if (file.size > maxUploadBytes) {
    return NextResponse.json({ error: "MRI image exceeds the upload limit" }, { status: 413 })
  }

  // 1) Inference on the ML backend (real engine; see backend ct_mri.analyze).
  let result: ScanAnalysisResult
  try {
    const upstream = new FormData()
    // Browsers tag .nii.gz as application/gzip; normalize only NIfTI uploads
    // while preserving standard image MIME types used by segmentation.
    const buf = await file.arrayBuffer()
    const blob = new Blob([buf], {
      type: isNifti ? "application/octet-stream" : file.type,
    })
    upstream.append("file", blob, file.name)
    const token = createBackendAccessToken(session.user.id)
    const endpoint = new URL("/api/v1/services/ct-mri/analyze", BACKEND_URL)
    endpoint.searchParams.set("patient_id", patientId)
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstream,
    })
    if (!res.ok) {
      const upstreamError = (await res.json().catch(() => null)) as { detail?: string } | null
      return NextResponse.json(
        { error: upstreamError?.detail ?? "MRI inference service failed" },
        { status: res.status }
      )
    }
    result = (await res.json()) as ScanAnalysisResult
  } catch {
    return NextResponse.json(
      { error: "MRI inference service is unavailable" },
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
