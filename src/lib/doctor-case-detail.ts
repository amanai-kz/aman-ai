import { AnalysisStatus, RiskLevel, ServiceType } from "@prisma/client"

import type { AppLocale } from "@/lib/app-locale"
import { getDoctorCopy } from "@/lib/doctor-copy"
import {
  createReviewState,
  type DoctorCaseAuditLog,
  type DoctorCaseReviewState,
  type ReviewAuditAction,
  type ReviewWorkflowStatus,
} from "@/lib/doctor-case-review"
import type { OodDetectionResult } from "@/lib/ood-detection"
import { mapRiskToPriority, type DoctorWorklistPriority } from "@/lib/doctor-worklist"

export type DoctorCaseViewerMode = "radiology" | "unavailable"
export type DoctorCaseGeneratedLabelKey =
  | "urgentNeuroradiologyFinding"
  | "neuroimagingReviewCandidate"
  | "physiologicTrendAlert"
  | "behavioralRiskScreeningSummary"
  | "aiTriageSummary"

export interface DoctorCaseDetail {
  id: string
  patientName: string
  patientEmail: string
  studyType: string
  priority: DoctorWorklistPriority
  status: string
  aiSummary: string
  updatedAt: string
  viewer: {
    mode: DoctorCaseViewerMode
    sequences: Array<{
      id: "t1" | "t2" | "flair" | "swi"
      slice: number
      previewLabel: string
    }>
    controls: {
      slice: {
        value: number
        min: number
        max: number
        step: number
      }
      zoom: number
      window: number
      level: number
    }
    metadata: {
      accession: string
      modality: string
      studyDate: string
      seriesCount: number
      sliceCount: number
      sourceKey: "pacsSyncPlaceholder" | "structuredSourcePlaceholder"
    }
  }
  ai: {
    generatedLabelKey: DoctorCaseGeneratedLabelKey
    findings: string[]
    confidenceScore: number
    priority: DoctorWorklistPriority
    manualReviewRequired: boolean
    abstain: boolean
    ood: OodDetectionResult | null
  }
  review: DoctorCaseReviewState
  auditLogs: DoctorCaseAuditLog[]
  persistenceUnavailable: boolean
}

export interface DoctorCaseAiPresentation {
  generatedLabel: string
  draftFindings: string
  draftImpression: string
  structuredFindings: Array<{
    label: string
    value: string
  }>
  evidence: string[]
}

type DoctorCaseDetailInput = {
  id: string
  patientName: string
  patientEmail: string
  studyType: string
  status: string
  riskLevel: RiskLevel | null
  findings: string[]
  confidence?: number | null
  ood?: OodDetectionResult | null
  updatedAt: Date
  review?: {
    findingsDraft?: string | null
    impressionDraft?: string | null
    workflowStatus?: ReviewWorkflowStatus | null
    signedAt?: Date | null
    signedById?: string | null
    signedByName?: string | null
    criticalAcknowledgedAt?: Date | null
    criticalAcknowledgedById?: string | null
    criticalAcknowledgedByName?: string | null
  } | null
  auditLogs?: Array<{
    action: ReviewAuditAction
    actorId: string
    actorName?: string | null
    details?: Record<string, unknown> | null
    createdAt: Date
  }>
  persistenceUnavailable?: boolean
}

const radiologySequences: DoctorCaseDetail["viewer"]["sequences"] = [
  { id: "t1", slice: 24, previewLabel: "T1" },
  { id: "t2", slice: 38, previewLabel: "T2" },
  { id: "flair", slice: 52, previewLabel: "FLAIR" },
  { id: "swi", slice: 61, previewLabel: "SWI" },
]

export function isRadiologyStudyType(studyType: string): boolean {
  return studyType === ServiceType.CT_MRI
}

export function buildDoctorCaseDetail(input: DoctorCaseDetailInput): DoctorCaseDetail {
  const priority = mapRiskToPriority(input.riskLevel)
  const viewerMode = isRadiologyStudyType(input.studyType) ? "radiology" : "unavailable"
  const normalizedFindings = input.findings.filter(Boolean)
  const ood = input.ood ?? null
  const confidenceSource = ood?.manualReviewRequired ? ood.confidence : input.confidence
  const confidenceScore = Math.max(
    0,
    Math.min(100, Math.round((confidenceSource ?? defaultConfidenceByPriority(priority)) * 100))
  )
  const aiSummary = ood?.manualReviewRequired
    ? ood.reasons.length > 0
      ? `Manual review required: ${ood.reasons.join(", ")}`
      : "Manual review required"
    : normalizedFindings.join(", ")

  return {
    id: input.id,
    patientName: input.patientName,
    patientEmail: input.patientEmail,
    studyType: input.studyType,
    priority,
    status: input.status,
    aiSummary,
    updatedAt: input.updatedAt.toISOString(),
    viewer: {
      mode: viewerMode,
      sequences: viewerMode === "radiology" ? radiologySequences : [],
      controls: {
        slice: {
          value: viewerMode === "radiology" ? 38 : 0,
          min: 1,
          max: viewerMode === "radiology" ? 96 : 0,
          step: 1,
        },
        zoom: viewerMode === "radiology" ? 125 : 100,
        window: viewerMode === "radiology" ? 70 : 0,
        level: viewerMode === "radiology" ? 35 : 0,
      },
      metadata: {
        accession: input.id.toUpperCase(),
        modality: viewerMode === "radiology" ? "MRI / DICOM" : input.studyType,
        studyDate: input.updatedAt.toISOString(),
        seriesCount: viewerMode === "radiology" ? 4 : 1,
        sliceCount: viewerMode === "radiology" ? 96 : 0,
        sourceKey: viewerMode === "radiology" ? "pacsSyncPlaceholder" : "structuredSourcePlaceholder",
      },
    },
    ai: {
      generatedLabelKey: getGeneratedLabelKey(input.studyType, priority),
      findings: normalizedFindings,
      confidenceScore,
      priority,
      manualReviewRequired: ood?.manualReviewRequired ?? false,
      abstain: ood?.abstain ?? false,
      ood,
    },
    review: createReviewState({
      findingsDraft: input.review?.findingsDraft ?? "",
      impressionDraft: input.review?.impressionDraft ?? "",
      workflowStatus: input.review?.workflowStatus ?? "DRAFT",
      signedAt: input.review?.signedAt?.toISOString() ?? null,
      signedById: input.review?.signedById ?? null,
      signedByName: input.review?.signedByName ?? null,
      criticalAcknowledgedAt: input.review?.criticalAcknowledgedAt?.toISOString() ?? null,
      criticalAcknowledgedById: input.review?.criticalAcknowledgedById ?? null,
      criticalAcknowledgedByName: input.review?.criticalAcknowledgedByName ?? null,
    }),
    auditLogs: (input.auditLogs ?? []).map((item) => ({
      action: item.action,
      actorId: item.actorId,
      actorName: item.actorName ?? null,
      details: item.details ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    persistenceUnavailable: input.persistenceUnavailable ?? false,
  }
}

export function buildMockDoctorCaseDetail(id: string): DoctorCaseDetail | null {
  if (id === "mock-critical-mri") {
    return buildDoctorCaseDetail({
      id,
      patientName: "Алексей Ким",
      patientEmail: "mock@amanai.kz",
      studyType: ServiceType.CT_MRI,
      status: AnalysisStatus.PENDING,
      riskLevel: RiskLevel.CRITICAL,
      findings: [
        "Marked signal asymmetry in the left frontoparietal region.",
        "Mild surrounding edema is visible on FLAIR.",
        "Prompt neuroradiology review is recommended.",
      ],
      confidence: 0.94,
      updatedAt: new Date("2026-06-09T12:30:00.000Z"),
    })
  }

  if (id === "mock-high-iot") {
    return buildDoctorCaseDetail({
      id,
      patientName: "Мария Сергеева",
      patientEmail: "mock@amanai.kz",
      studyType: ServiceType.IOT,
      status: AnalysisStatus.PROCESSING,
      riskLevel: RiskLevel.HIGH,
      findings: [
        "Sustained elevated stress score over the last 30 minutes.",
        "Heart-rate variability remains below the personalized baseline.",
      ],
      confidence: 0.78,
      updatedAt: new Date("2026-06-09T11:10:00.000Z"),
    })
  }

  if (id === "mock-normal-questionnaire") {
    return buildDoctorCaseDetail({
      id,
      patientName: "Дмитрий Павлов",
      patientEmail: "mock@amanai.kz",
      studyType: ServiceType.QUESTIONNAIRE,
      status: AnalysisStatus.COMPLETED,
      riskLevel: null,
      findings: [
        "Moderate symptom burden without immediate safety flags.",
        "Follow-up review can proceed in the standard queue.",
      ],
      confidence: 0.69,
      updatedAt: new Date("2026-06-08T16:45:00.000Z"),
    })
  }

  return null
}

function defaultConfidenceByPriority(priority: DoctorWorklistPriority): number {
  if (priority === "CRITICAL") return 0.91
  if (priority === "HIGH") return 0.82
  return 0.71
}

function getGeneratedLabelKey(
  studyType: string,
  priority: DoctorWorklistPriority
): DoctorCaseGeneratedLabelKey {
  if (studyType === ServiceType.CT_MRI) {
    return priority === "CRITICAL"
      ? "urgentNeuroradiologyFinding"
      : "neuroimagingReviewCandidate"
  }

  if (studyType === ServiceType.IOT) {
    return "physiologicTrendAlert"
  }

  if (studyType === ServiceType.QUESTIONNAIRE) {
    return "behavioralRiskScreeningSummary"
  }

  return "aiTriageSummary"
}

export function getDoctorCaseAiPresentation(
  detail: DoctorCaseDetail,
  locale: AppLocale
): DoctorCaseAiPresentation {
  if (detail.ai.manualReviewRequired) {
    const reasons = detail.ai.ood?.reasons ?? []
    const reasonSummary = reasons.length > 0 ? reasons.join(", ") : "OUTSIDE_TRAINING_DISTRIBUTION"

    return {
      generatedLabel: "Manual review required",
      draftFindings: "",
      draftImpression: "",
      structuredFindings: [
        { label: "AI status", value: "Abstained" },
        { label: "Routing", value: "Manual review required" },
        { label: "Reasons", value: reasonSummary },
      ],
      evidence: [`AI abstained: ${reasonSummary}`],
    }
  }

  const copy = getDoctorCopy(locale).caseDetail
  const findings =
    detail.ai.findings.length > 0
      ? detail.ai.findings
      : [copy.structuredFindingFallbacks.noFindings]
  const leadFinding = findings[0]
  const impressionPrefix =
    detail.ai.priority === "CRITICAL"
      ? copy.impressionTemplates.critical
      : detail.ai.priority === "HIGH"
        ? copy.impressionTemplates.high
        : copy.impressionTemplates.normal
  const evidence = findings.slice(0, 2)

  evidence.push(
    detail.viewer.mode === "radiology"
      ? copy.evidenceNotes.radiologyPlaceholder
      : copy.evidenceNotes.unavailableViewer
  )

  return {
    generatedLabel: copy.generatedLabels[detail.ai.generatedLabelKey],
    draftFindings: `${
      detail.viewer.mode === "radiology" ? copy.draftPrefixes.radiology : copy.draftPrefixes.unavailable
    }${findings.join(" ")}`,
    draftImpression: `${impressionPrefix} ${leadFinding}`.trim(),
    structuredFindings: [
      {
        label: copy.structuredFindingLabels.primarySignal,
        value: leadFinding,
      },
      {
        label: copy.structuredFindingLabels.supportingObservation,
        value: findings[1] ?? copy.structuredFindingFallbacks.noSecondaryObservation,
      },
      {
        label: copy.structuredFindingLabels.reviewMode,
        value:
          detail.viewer.mode === "radiology"
            ? copy.reviewModeValues.radiology
            : copy.reviewModeValues.unavailable,
      },
    ],
    evidence,
  }
}

export function getDoctorCaseReportDrafts(detail: DoctorCaseDetail, locale: AppLocale) {
  if (detail.review.findingsDraft || detail.review.impressionDraft) {
    return {
      findingsDraft: detail.review.findingsDraft,
      impressionDraft: detail.review.impressionDraft,
    }
  }

  if (detail.ai.manualReviewRequired) {
    return {
      findingsDraft: "",
      impressionDraft: "",
    }
  }

  const copy = getDoctorCopy(locale).caseDetail
  const findings =
    detail.ai.findings.length > 0
      ? detail.ai.findings
      : [copy.structuredFindingFallbacks.noFindings]

  return {
    findingsDraft: findings.join("\n"),
    impressionDraft: getDoctorCaseAiPresentation(detail, locale).draftImpression,
  }
}

export function getDoctorCaseReviewStatusLabel(
  workflowStatus: ReviewWorkflowStatus,
  locale: AppLocale
) {
  const statuses = getDoctorCopy(locale).caseDetail.reviewStatuses

  if (workflowStatus === "SIGNED") return statuses.signed
  if (workflowStatus === "EDITED") return statuses.edited
  return statuses.draft
}

export function getDoctorCaseAuditActionLabel(
  action: ReviewAuditAction,
  locale: AppLocale
) {
  const labels = getDoctorCopy(locale).caseDetail.auditActions

  switch (action) {
    case "AI_DRAFT_VIEWED":
      return labels.aiDraftViewed
    case "REPORT_EDITED":
      return labels.reportEdited
    case "DRAFT_SAVED":
      return labels.draftSaved
    case "AI_DRAFT_ACCEPTED":
      return labels.aiDraftAccepted
    case "AI_DRAFT_REJECTED":
      return labels.aiDraftRejected
    case "REPORT_SIGNED_OFF":
      return labels.reportSignedOff
    case "CRITICAL_FINDING_ACKNOWLEDGED":
      return labels.criticalFindingAcknowledged
  }
}
