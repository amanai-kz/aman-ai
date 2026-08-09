import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { DoctorCaseDetailView } from "@/components/doctor-case-detail-view"
import { DashboardBackground } from "@/components/dashboard-background"
import { DashboardHeader } from "@/components/dashboard-header"
import {
  buildDoctorCaseDetail,
  buildMockDoctorCaseDetail,
  getStoredSegmentation,
} from "@/lib/doctor-case-detail"

async function getCaseDetail(id: string, actor: { userId: string; name?: string | null }) {
  try {
    const doctor = await db.doctor.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    })

    if (doctor) {
      const review = await db.analysisReview.upsert({
        where: { analysisId: id },
        update: {},
        create: {
          analysisId: id,
          doctorId: doctor.id,
        },
      })

      await db.analysisReviewAuditLog.create({
        data: {
          analysisReviewId: review.id,
          action: "AI_DRAFT_VIEWED",
          actorId: actor.userId,
          details: actor.name ? { actorName: actor.name } : undefined,
        },
      })
    }

    const analysis = await db.analysis.findUnique({
      where: { id },
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
        auditLogs: analysis.review?.auditLogs.map((item) => ({
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
  } catch {
    // Fallback to mock data below when local DB is not ready.
  }

  const mockDetail = buildMockDoctorCaseDetail(id)

  if (!mockDetail) {
    return null
  }

  return {
    ...mockDetail,
    persistenceUnavailable: true,
  }
}

export default async function DoctorCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "DOCTOR") redirect("/dashboard")

  const { id } = await params
  const detail = await getCaseDetail(id, {
    userId: session.user.id,
    name: session.user.name,
  })

  if (!detail) {
    redirect("/doctor/worklist")
  }

  return (
    <>
      <DashboardHeader titleKey="doctorCaseDetail" />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <DoctorCaseDetailView detail={detail} />
        </div>
      </div>
    </>
  )
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
