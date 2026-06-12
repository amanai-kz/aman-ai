import {
  AnalysisStatus,
  ReviewWorkflowStatus,
  RiskLevel,
  ServiceType,
} from "@prisma/client"

export const MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID = "manual-unsigned-critical-mri"
export const MANUAL_UNSIGNED_CRITICAL_MRI_CASE_URL =
  "/doctor/cases/manual-unsigned-critical-mri"

export function buildManualUnsignedCriticalMriAnalysis(patientId: string) {
  return {
    id: MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID,
    patientId,
    serviceType: ServiceType.CT_MRI,
    status: AnalysisStatus.PENDING,
    confidence: 0.94,
    riskLevel: RiskLevel.CRITICAL,
    findings: [
      "Marked signal asymmetry in the left frontoparietal region.",
      "Mild surrounding edema is visible on FLAIR.",
    ],
    inputData: {
      modality: "MRI / DICOM",
      source: "local-dev-review-seed",
      sequences: ["T1", "T2", "FLAIR", "SWI"],
    },
    result: {
      label: "Probable urgent neuroradiology finding",
      structuredFindings: [
        "Marked signal asymmetry in the left frontoparietal region.",
        "Mild surrounding edema is visible on FLAIR.",
      ],
    },
  }
}

export function buildManualUnsignedCriticalMriReview(doctorId: string) {
  return {
    doctorId,
    verified: false,
    notes: null,
    diagnosis: null,
    findingsDraft: null,
    impressionDraft: null,
    workflowStatus: ReviewWorkflowStatus.DRAFT,
    signedAt: null,
    signedById: null,
    criticalAcknowledgedAt: null,
    criticalAcknowledgedById: null,
  }
}
