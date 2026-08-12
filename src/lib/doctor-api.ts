import { AnalysisStatus } from "@prisma/client"
import { z } from "zod"

import {
  buildDoctorCaseDetail,
  getDoctorCaseReportDrafts,
  getStoredSegmentation,
} from "@/lib/doctor-case-detail"
import { db } from "@/lib/db"
import { getDoctorCaseReviewErrorPayload } from "@/lib/doctor-case-review-errors"
import { formatManualReviewSummary, getStoredOodDetection } from "@/lib/ood-detection"
import {
  acceptAiDraft,
  acknowledgeCriticalFinding,
  createReviewState,
  rejectAiDraft,
  saveReviewDraft,
  signOffReview,
  type ReviewAuditAction,
} from "@/lib/doctor-case-review"
import { mapRiskToPriority, sortDoctorWorklistCases, type DoctorWorklistCase } from "@/lib/doctor-worklist"

type DoctorApiDb = typeof db

type SessionLike =
  | {
      user: {
        id: string
        role: string
        name?: string | null
      }
    }
  | null

type DoctorApiActor = {
  userId: string
  name: string | null
  role: "DOCTOR" | "ADMIN"
  doctorId: string | null
  isAdmin: boolean
}

type AuditLogRecord = {
  action: ReviewAuditAction
  actorId: string
  details: unknown
  createdAt: Date
}

type AnalysisRecord = {
  id: string
  patientId: string
  serviceType: string
  status: string
  riskLevel: Parameters<typeof mapRiskToPriority>[0]
  findings: string[]
  confidence: number | null
  result: unknown
  updatedAt: Date
  patient: {
    user: {
      name: string | null
      email: string | null
    }
  }
  review: null | {
    doctorId: string
    verified: boolean
    findingsDraft: string | null
    impressionDraft: string | null
    workflowStatus: "DRAFT" | "EDITED" | "SIGNED"
    signedAt: Date | null
    signedById: string | null
    criticalAcknowledgedAt: Date | null
    criticalAcknowledgedById: string | null
    auditLogs: AuditLogRecord[]
  }
}

type ApiSuccess<T> = {
  status: number
  body: {
    data: T
  }
}

type ApiFailure = {
  status: number
  body: {
    error: string
    errorKey: string
  }
}

export type DoctorApiResponse<T> = ApiSuccess<T> | ApiFailure

type ReviewPatchAction =
  | "saveDraft"
  | "acceptAiDraft"
  | "rejectAiDraft"
  | "acknowledgeCritical"
  | "signOff"

const reviewPatchSchema = z.object({
  action: z.enum([
    "saveDraft",
    "acceptAiDraft",
    "rejectAiDraft",
    "acknowledgeCritical",
    "signOff",
  ]),
  findingsDraft: z.string().optional(),
  impressionDraft: z.string().optional(),
})

class DoctorApiError extends Error {
  readonly status: number
  readonly errorKey: string

  constructor(errorKey: string, message: string, status: number) {
    super(message)
    this.name = "DoctorApiError"
    this.errorKey = errorKey
    this.status = status
  }
}

export async function getDoctorTriageResponse(
  prisma: DoctorApiDb,
  session: SessionLike
): Promise<DoctorApiResponse<{
  items: DoctorWorklistCase[]
  total: number
  counts: Record<"CRITICAL" | "HIGH" | "NORMAL", number>
}>> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const analyses = await listAccessibleAnalyses(prisma, actor)
    const items = sortDoctorWorklistCases(analyses.map(mapAnalysisToWorklistCase))

    return ok({
      items,
      total: items.length,
      counts: {
        CRITICAL: items.filter((item) => item.priority === "CRITICAL").length,
        HIGH: items.filter((item) => item.priority === "HIGH").length,
        NORMAL: items.filter((item) => item.priority === "NORMAL").length,
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function getDoctorCasesResponse(
  prisma: DoctorApiDb,
  session: SessionLike
): Promise<DoctorApiResponse<{ cases: DoctorWorklistCase[] }>> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const analyses = await listAccessibleAnalyses(prisma, actor)

    return ok({
      cases: sortDoctorWorklistCases(analyses.map(mapAnalysisToWorklistCase)),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function getDoctorCaseResponse(
  prisma: DoctorApiDb,
  session: SessionLike,
  caseId: string
): Promise<DoctorApiResponse<{ case: ReturnType<typeof buildDoctorCaseDetail> }>> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const analysis = await getAccessibleAnalysisOrThrow(prisma, actor, caseId)

    return ok({
      case: buildDoctorCaseDetailFromAnalysis(analysis),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function getDoctorCaseFindingsResponse(
  prisma: DoctorApiDb,
  session: SessionLike,
  caseId: string
): Promise<
  DoctorApiResponse<{
    caseId: string
    ai: ReturnType<typeof buildDoctorCaseDetail>["ai"]
    reportDrafts: {
      findingsDraft: string
      impressionDraft: string
    }
    review: ReturnType<typeof buildDoctorCaseDetail>["review"]
  }>
> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const analysis = await getAccessibleAnalysisOrThrow(prisma, actor, caseId)
    const detail = buildDoctorCaseDetailFromAnalysis(analysis)

    return ok({
      caseId: detail.id,
      ai: detail.ai,
      reportDrafts: getDoctorCaseReportDrafts(detail, "en"),
      review: detail.review,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function getDoctorCaseReportResponse(
  prisma: DoctorApiDb,
  session: SessionLike,
  caseId: string
): Promise<
  DoctorApiResponse<{
    caseId: string
    findingsDraft: string
    impressionDraft: string
    workflowStatus: string
    signedAt: string | null
    signedById: string | null
    criticalAcknowledgedAt: string | null
    criticalAcknowledgedById: string | null
    isReadOnly: boolean
  }>
> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const analysis = await getAccessibleAnalysisOrThrow(prisma, actor, caseId)
    const detail = buildDoctorCaseDetailFromAnalysis(analysis)
    const drafts = getDoctorCaseReportDrafts(detail, "en")

    return ok({
      caseId: detail.id,
      findingsDraft: drafts.findingsDraft,
      impressionDraft: drafts.impressionDraft,
      workflowStatus: detail.review.workflowStatus,
      signedAt: detail.review.signedAt,
      signedById: detail.review.signedById,
      criticalAcknowledgedAt: detail.review.criticalAcknowledgedAt,
      criticalAcknowledgedById: detail.review.criticalAcknowledgedById,
      isReadOnly: detail.review.isLocked,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function getDoctorCaseAuditResponse(
  prisma: DoctorApiDb,
  session: SessionLike,
  caseId: string
): Promise<
  DoctorApiResponse<{
    caseId: string
    auditLogs: ReturnType<typeof buildDoctorCaseDetail>["auditLogs"]
  }>
> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const analysis = await getAccessibleAnalysisOrThrow(prisma, actor, caseId)
    const detail = buildDoctorCaseDetailFromAnalysis(analysis)

    return ok({
      caseId: detail.id,
      auditLogs: detail.auditLogs,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function patchDoctorCaseReviewResponse(
  prisma: DoctorApiDb,
  session: SessionLike,
  caseId: string,
  input: unknown
): Promise<DoctorApiResponse<{ review: unknown }>> {
  try {
    const actor = await requireDoctorApiActor(prisma, session)
    const parsed = reviewPatchSchema.safeParse(input)

    if (!parsed.success) {
      throw new DoctorApiError("INVALID_BODY", "Invalid request body", 400)
    }

    const analysis = await getAccessibleAnalysisOrThrow(prisma, actor, caseId)
    const persisted = analysis.review
      ? createReviewState({
          findingsDraft: analysis.review.findingsDraft ?? "",
          impressionDraft: analysis.review.impressionDraft ?? "",
          workflowStatus: analysis.review.workflowStatus,
          signedAt: analysis.review.signedAt?.toISOString() ?? null,
          signedById: analysis.review.signedById ?? null,
          signedByName:
            getActorNameFromAuditLogs(analysis.review.auditLogs, analysis.review.signedById) ?? null,
          criticalAcknowledgedAt: analysis.review.criticalAcknowledgedAt?.toISOString() ?? null,
          criticalAcknowledgedById: analysis.review.criticalAcknowledgedById ?? null,
          criticalAcknowledgedByName:
            getActorNameFromAuditLogs(
              analysis.review.auditLogs,
              analysis.review.criticalAcknowledgedById
            ) ?? null,
        })
      : createReviewState()

    const action = parsed.data.action
    const findingsDraft = parsed.data.findingsDraft ?? ""
    const impressionDraft = parsed.data.impressionDraft ?? ""
    const reviewDoctorId = actor.doctorId ?? analysis.review?.doctorId ?? null

    if (!reviewDoctorId) {
      throw new DoctorApiError("FORBIDDEN", "Forbidden", 403)
    }

    const nextReview =
      action === "saveDraft"
        ? saveReviewDraft(persisted, { findingsDraft, impressionDraft })
        : action === "acceptAiDraft"
          ? acceptAiDraft(persisted, { findingsDraft, impressionDraft })
          : action === "rejectAiDraft"
            ? rejectAiDraft(persisted)
            : action === "acknowledgeCritical"
              ? acknowledgeCriticalFinding(persisted, {
                  actorId: actor.userId,
                  actorName: actor.name,
                  at: new Date().toISOString(),
                })
              : action === "signOff"
                ? signOffReview(
                    saveReviewDraft(persisted, { findingsDraft, impressionDraft }),
                    {
                      actorId: actor.userId,
                      actorName: actor.name,
                      at: new Date().toISOString(),
                    }
                  )
                : null

    if (!nextReview) {
      throw new DoctorApiError("UNSUPPORTED_REVIEW_ACTION", "Unsupported action", 400)
    }

    if (action === "signOff" && analysis.riskLevel === "CRITICAL" && !nextReview.criticalAcknowledgedAt) {
      throw new DoctorApiError(
        "CRITICAL_ACK_REQUIRED",
        "Critical finding must be acknowledged before sign-off",
        409
      )
    }

    const review = await prisma.analysisReview.upsert({
      where: { analysisId: caseId },
      update: {
        doctorId: reviewDoctorId,
        verified: action === "signOff" ? true : analysis.review?.verified ?? false,
        notes: nextReview.findingsDraft || null,
        diagnosis: nextReview.impressionDraft || null,
        findingsDraft: nextReview.findingsDraft || null,
        impressionDraft: nextReview.impressionDraft || null,
        workflowStatus: nextReview.workflowStatus,
        signedAt: nextReview.signedAt ? new Date(nextReview.signedAt) : null,
        signedById: nextReview.signedById,
        criticalAcknowledgedAt: nextReview.criticalAcknowledgedAt
          ? new Date(nextReview.criticalAcknowledgedAt)
          : null,
        criticalAcknowledgedById: nextReview.criticalAcknowledgedById,
      },
      create: {
        analysisId: caseId,
        doctorId: reviewDoctorId,
        verified: action === "signOff",
        notes: nextReview.findingsDraft || null,
        diagnosis: nextReview.impressionDraft || null,
        findingsDraft: nextReview.findingsDraft || null,
        impressionDraft: nextReview.impressionDraft || null,
        workflowStatus: nextReview.workflowStatus,
        signedAt: nextReview.signedAt ? new Date(nextReview.signedAt) : null,
        signedById: nextReview.signedById,
        criticalAcknowledgedAt: nextReview.criticalAcknowledgedAt
          ? new Date(nextReview.criticalAcknowledgedAt)
          : null,
        criticalAcknowledgedById: nextReview.criticalAcknowledgedById,
      },
      include: {
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    const draftChanged =
      persisted.findingsDraft !== nextReview.findingsDraft ||
      persisted.impressionDraft !== nextReview.impressionDraft

    if (draftChanged) {
      await prisma.analysisReviewAuditLog.create({
        data: {
          analysisReviewId: review.id,
          action: "REPORT_EDITED",
          actorId: actor.userId,
          details: {
            actorName: actor.name,
            workflowStatus: nextReview.workflowStatus,
          },
        },
      })
    }

    await prisma.analysisReviewAuditLog.create({
      data: {
        analysisReviewId: review.id,
        action: mapPatchActionToAuditAction(action),
        actorId: actor.userId,
        details: {
          actorName: actor.name,
          workflowStatus: nextReview.workflowStatus,
        },
      },
    })

    if (action === "signOff") {
      await prisma.analysis.update({
        where: { id: caseId },
        data: { status: AnalysisStatus.REVIEWED },
      })
    }

    const freshReview = await prisma.analysisReview.findUnique({
      where: { analysisId: caseId },
      include: {
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return ok({
      review: freshReview,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return err(400, "INVALID_BODY", "Invalid request body")
    }

    return toErrorResponse(error)
  }
}

async function requireDoctorApiActor(prisma: DoctorApiDb, session: SessionLike): Promise<DoctorApiActor> {
  if (!session?.user?.id) {
    throw new DoctorApiError("UNAUTHENTICATED", "Authentication required", 401)
  }

  if (session.user.role === "ADMIN") {
    return {
      userId: session.user.id,
      name: session.user.name ?? null,
      role: "ADMIN",
      doctorId: null,
      isAdmin: true,
    }
  }

  if (session.user.role !== "DOCTOR") {
    throw new DoctorApiError("FORBIDDEN", "Forbidden", 403)
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!doctor) {
    throw new DoctorApiError("DOCTOR_PROFILE_REQUIRED", "Doctor profile not found", 403)
  }

  return {
    userId: session.user.id,
    name: session.user.name ?? null,
    role: "DOCTOR",
    doctorId: doctor.id,
    isAdmin: false,
  }
}

async function listAccessibleAnalyses(prisma: DoctorApiDb, actor: DoctorApiActor) {
  return prisma.analysis.findMany({
    where: actor.isAdmin
      ? undefined
      : {
          patient: {
            assignedDoctors: {
              some: {
                doctorId: actor.doctorId!,
              },
            },
          },
        },
    take: 100,
    orderBy: { updatedAt: "desc" },
    include: {
      patient: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      review: {
        include: {
          auditLogs: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })
}

async function getAccessibleAnalysisOrThrow(prisma: DoctorApiDb, actor: DoctorApiActor, caseId: string) {
  const analysis = await prisma.analysis.findFirst({
    where: actor.isAdmin
      ? { id: caseId }
      : {
          id: caseId,
          patient: {
            assignedDoctors: {
              some: {
                doctorId: actor.doctorId!,
              },
            },
          },
        },
    include: {
      patient: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      review: {
        include: {
          auditLogs: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })

  if (analysis) {
    return analysis
  }

  const existing = await prisma.analysis.findUnique({
    where: { id: caseId },
    select: { id: true },
  })

  if (existing) {
    throw new DoctorApiError("FORBIDDEN", "Forbidden", 403)
  }

  throw new DoctorApiError("CASE_NOT_FOUND", "Case not found", 404)
}

function buildDoctorCaseDetailFromAnalysis(analysis: AnalysisRecord) {
  const ood = getStoredOodDetection(analysis.result)
  const signedByName = getActorNameFromAuditLogs(
    analysis.review?.auditLogs ?? [],
    analysis.review?.signedById
  )
  const criticalAcknowledgedByName = getActorNameFromAuditLogs(
    analysis.review?.auditLogs ?? [],
    analysis.review?.criticalAcknowledgedById
  )

  return buildDoctorCaseDetail({
    id: analysis.id,
    patientName: analysis.patient.user.name || "",
    patientEmail: analysis.patient.user.email || "",
    studyType: analysis.serviceType,
    status: analysis.status,
    riskLevel: analysis.riskLevel,
    findings: analysis.findings,
    confidence: analysis.confidence,
    ood,
    segmentation: getStoredSegmentation(analysis.result),
    updatedAt: analysis.updatedAt,
    review: analysis.review
      ? {
          findingsDraft: analysis.review.findingsDraft,
          impressionDraft: analysis.review.impressionDraft,
          workflowStatus: analysis.review.workflowStatus,
          signedAt: analysis.review.signedAt,
          signedById: analysis.review.signedById,
          signedByName,
          criticalAcknowledgedAt: analysis.review.criticalAcknowledgedAt,
          criticalAcknowledgedById: analysis.review.criticalAcknowledgedById,
          criticalAcknowledgedByName,
        }
      : null,
    auditLogs: (analysis.review?.auditLogs ?? []).map((item: AuditLogRecord) => ({
      action: item.action,
      actorId: item.actorId,
      actorName:
        typeof item.details === "object" && item.details && "actorName" in item.details
          ? (item.details as { actorName?: string | null }).actorName ?? null
          : null,
      details:
        item.details && typeof item.details === "object"
          ? (item.details as Record<string, unknown>)
          : null,
      createdAt: item.createdAt,
    })),
  })
}

function mapAnalysisToWorklistCase(analysis: AnalysisRecord): DoctorWorklistCase {
  const ood = getStoredOodDetection(analysis.result)
  return {
    id: analysis.id,
    patientId: analysis.patientId,
    patientName: analysis.patient.user.name || "",
    studyType: analysis.serviceType,
    priority: mapRiskToPriority(analysis.riskLevel),
    status: analysis.status,
    aiSummary:
      ood?.manualReviewRequired
        ? formatManualReviewSummary(ood)
        : analysis.findings.length > 0
          ? analysis.findings.join(", ")
          : "",
    manualReviewRequired: ood?.manualReviewRequired ?? false,
    abstain: ood?.abstain ?? false,
    oodReasons: ood?.reasons ?? [],
    updatedAt: analysis.updatedAt.toISOString(),
  }
}

function mapPatchActionToAuditAction(action: ReviewPatchAction): ReviewAuditAction {
  switch (action) {
    case "saveDraft":
      return "DRAFT_SAVED"
    case "acceptAiDraft":
      return "AI_DRAFT_ACCEPTED"
    case "rejectAiDraft":
      return "AI_DRAFT_REJECTED"
    case "acknowledgeCritical":
      return "CRITICAL_FINDING_ACKNOWLEDGED"
    case "signOff":
      return "REPORT_SIGNED_OFF"
  }
}

function getActorNameFromAuditLogs(
  logs: Array<{ actorId: string; details: unknown }>,
  actorId?: string | null
) {
  if (!actorId) return null

  const match = logs.find((item) => item.actorId === actorId)
  if (!match || typeof match.details !== "object" || !match.details) {
    return null
  }

  return "actorName" in match.details
    ? ((match.details as { actorName?: string | null }).actorName ?? null)
    : null
}

function ok<T>(data: T): ApiSuccess<T> {
  return {
    status: 200,
    body: { data },
  }
}

function err(status: number, errorKey: string, error: string): ApiFailure {
  return {
    status,
    body: { error, errorKey },
  }
}

function toErrorResponse(error: unknown): ApiFailure {
  if (error instanceof DoctorApiError) {
    return err(error.status, error.errorKey, error.message)
  }

  const payload = getDoctorCaseReviewErrorPayload(error)
  return err(payload.status, payload.errorKey, payload.error)
}
