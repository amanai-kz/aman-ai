import { AnalysisStatus } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getDoctorCaseReviewErrorPayload } from "@/lib/doctor-case-review-errors"
import {
  acceptAiDraft,
  acknowledgeCriticalFinding,
  createReviewState,
  rejectAiDraft,
  saveReviewDraft,
  signOffReview,
  type ReviewAuditAction,
} from "@/lib/doctor-case-review"

type ReviewPatchAction =
  | "saveDraft"
  | "acceptAiDraft"
  | "rejectAiDraft"
  | "acknowledgeCritical"
  | "signOff"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== "DOCTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const doctor = await db.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!doctor) {
      return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 })
    }

    const { id } = await params
    const body = await req.json()
    const action = body.action as ReviewPatchAction
    const findingsDraft = typeof body.findingsDraft === "string" ? body.findingsDraft : ""
    const impressionDraft = typeof body.impressionDraft === "string" ? body.impressionDraft : ""

    const analysis = await db.analysis.findUnique({
      where: { id },
      include: {
        review: {
          include: {
            auditLogs: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

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
            getActorNameFromAuditLogs(analysis.review.auditLogs, analysis.review.criticalAcknowledgedById) ?? null,
        })
      : createReviewState()

    const actor = {
      actorId: session.user.id,
      actorName: session.user.name ?? null,
      at: new Date().toISOString(),
    }

    const nextReview =
      action === "saveDraft"
        ? saveReviewDraft(persisted, { findingsDraft, impressionDraft })
        : action === "acceptAiDraft"
          ? acceptAiDraft(persisted, { findingsDraft, impressionDraft })
          : action === "rejectAiDraft"
            ? rejectAiDraft(persisted)
            : action === "acknowledgeCritical"
              ? acknowledgeCriticalFinding(persisted, actor)
              : action === "signOff"
                ? signOffReview(
                    saveReviewDraft(persisted, { findingsDraft, impressionDraft }),
                    actor
                  )
                : null

    if (!nextReview) {
      return NextResponse.json(
        { error: "Unsupported action", errorKey: "UNSUPPORTED_REVIEW_ACTION" },
        { status: 400 }
      )
    }

    const auditAction = mapPatchActionToAuditAction(action)
    const draftChanged =
      persisted.findingsDraft !== nextReview.findingsDraft ||
      persisted.impressionDraft !== nextReview.impressionDraft

    if (action === "signOff" && analysis.riskLevel === "CRITICAL" && !nextReview.criticalAcknowledgedAt) {
      return NextResponse.json(
        {
          error: "Critical finding must be acknowledged before sign-off",
          errorKey: "CRITICAL_ACK_REQUIRED",
        },
        { status: 400 }
      )
    }

    const review = await db.analysisReview.upsert({
      where: { analysisId: id },
      update: {
        doctorId: doctor.id,
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
        analysisId: id,
        doctorId: doctor.id,
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

    if (draftChanged) {
      await db.analysisReviewAuditLog.create({
        data: {
          analysisReviewId: review.id,
          action: "REPORT_EDITED",
          actorId: session.user.id,
          details: {
            actorName: session.user.name ?? null,
            workflowStatus: nextReview.workflowStatus,
          },
        },
      })
    }

    await db.analysisReviewAuditLog.create({
      data: {
        analysisReviewId: review.id,
        action: auditAction,
        actorId: session.user.id,
        details: {
          actorName: session.user.name ?? null,
          workflowStatus: nextReview.workflowStatus,
        },
      },
    })

    if (action === "signOff") {
      await db.analysis.update({
        where: { id },
        data: { status: AnalysisStatus.REVIEWED },
      })
    }

    const freshReview = await db.analysisReview.findUnique({
      where: { analysisId: id },
      include: {
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json({
      success: true,
      review: freshReview,
    })
  } catch (error) {
    console.error("Doctor case review update error:", error)
    const payload = getDoctorCaseReviewErrorPayload(error)

    return NextResponse.json(
      { error: payload.error, errorKey: payload.errorKey },
      { status: payload.status }
    )
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
