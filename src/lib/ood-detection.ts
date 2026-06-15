import { ServiceType } from "@prisma/client"

export type OodReason =
  | "UNSUPPORTED_MODALITY"
  | "UNSUPPORTED_STUDY_TYPE"
  | "MISSING_STUDY_METADATA"
  | "UNSUPPORTED_SEQUENCE"
  | "LOW_MODEL_CONFIDENCE"
  | "UNKNOWN_SCANNER"
  | "OUTSIDE_TRAINING_DISTRIBUTION"

export type OodSeverity = "low" | "medium" | "high"

export type OodDetectionResult = {
  isOod: boolean
  manualReviewRequired: boolean
  abstain: boolean
  reasons: OodReason[]
  severity: OodSeverity
  confidence: number
  checkedAt: string
}

type OodDetectionInput = {
  serviceType: ServiceType
  inputData: unknown
  confidence?: number | null
  checkedAt?: string | Date
}

const SUPPORTED_CT_MRI_MODALITIES = new Set(["MR", "MRI", "CT"])
const SUPPORTED_CT_MRI_BODY_PARTS = new Set(["BRAIN", "HEAD", "NEURO", "NEUROCRANIUM"])
const SUPPORTED_CT_MRI_SEQUENCES = new Set(["T1", "T2", "FLAIR", "SWI", "DWI", "ADC"])
const SUPPORTED_SCANNERS = new Set(["SIEMENS", "GE", "GE HEALTHCARE", "PHILIPS", "CANON", "TOSHIBA"])

export function detectOutOfDistributionStudy(input: OodDetectionInput): OodDetectionResult {
  const ingestion = getIngestionRecord(input.inputData)
  const reasons = new Set<OodReason>()

  if (!Object.values(ServiceType).includes(input.serviceType)) {
    reasons.add("UNSUPPORTED_STUDY_TYPE")
  }

  if (!ingestion?.modality || !ingestion.studyDate || !ingestion.sourceStudyId) {
    reasons.add("MISSING_STUDY_METADATA")
  }

  if (input.serviceType === ServiceType.CT_MRI) {
    const modality = normalizeToken(ingestion?.modality)
    if (modality && !SUPPORTED_CT_MRI_MODALITIES.has(modality)) {
      reasons.add("UNSUPPORTED_MODALITY")
    }

    const bodyPart = normalizeToken(ingestion?.bodyPart ?? ingestion?.anatomy)
    if (bodyPart && !SUPPORTED_CT_MRI_BODY_PARTS.has(bodyPart)) {
      reasons.add("OUTSIDE_TRAINING_DISTRIBUTION")
    }

    const sequenceNames = getSequenceNames(ingestion?.series)
    if (sequenceNames.some((name) => !SUPPORTED_CT_MRI_SEQUENCES.has(name))) {
      reasons.add("UNSUPPORTED_SEQUENCE")
    }

    const manufacturer = normalizeToken(ingestion?.manufacturer ?? ingestion?.scannerManufacturer)
    if (manufacturer && !SUPPORTED_SCANNERS.has(manufacturer)) {
      reasons.add("UNKNOWN_SCANNER")
    }
  }

  if (typeof input.confidence === "number" && input.confidence < 0.8) {
    reasons.add("LOW_MODEL_CONFIDENCE")
  }

  const reasonsList = [...reasons]
  const severity = getSeverity(reasonsList)
  const isOod = reasonsList.length > 0

  return {
    isOod,
    manualReviewRequired: isOod,
    abstain: isOod,
    reasons: reasonsList,
    severity,
    confidence: getDetectionConfidence(isOod, severity, input.confidence),
    checkedAt: createCheckedAt(input.checkedAt),
  }
}

export function getStoredOodDetection(result: unknown): OodDetectionResult | null {
  if (!isRecord(result) || !isRecord(result.oodDetection)) {
    return null
  }

  return parseOodDetection(result.oodDetection)
}

export function formatManualReviewSummary(ood: OodDetectionResult | null): string {
  if (!ood?.manualReviewRequired) {
    return ""
  }

  return ood.reasons.length > 0
    ? `Manual review required: ${ood.reasons.join(", ")}`
    : "Manual review required"
}

function parseOodDetection(value: Record<string, unknown>): OodDetectionResult | null {
  if (
    typeof value.isOod !== "boolean" ||
    typeof value.manualReviewRequired !== "boolean" ||
    typeof value.abstain !== "boolean" ||
    !Array.isArray(value.reasons) ||
    !value.reasons.every(isOodReason) ||
    !isOodSeverity(value.severity) ||
    typeof value.confidence !== "number" ||
    typeof value.checkedAt !== "string"
  ) {
    return null
  }

  return {
    isOod: value.isOod,
    manualReviewRequired: value.manualReviewRequired,
    abstain: value.abstain,
    reasons: value.reasons,
    severity: value.severity,
    confidence: clamp(value.confidence),
    checkedAt: value.checkedAt,
  }
}

function getSeverity(reasons: OodReason[]): OodSeverity {
  if (
    reasons.some((reason) =>
      [
        "UNSUPPORTED_MODALITY",
        "UNSUPPORTED_STUDY_TYPE",
        "MISSING_STUDY_METADATA",
        "UNSUPPORTED_SEQUENCE",
        "OUTSIDE_TRAINING_DISTRIBUTION",
      ].includes(reason)
    )
  ) {
    return "high"
  }

  if (reasons.some((reason) => reason === "LOW_MODEL_CONFIDENCE" || reason === "UNKNOWN_SCANNER")) {
    return "medium"
  }

  return "low"
}

function getDetectionConfidence(
  isOod: boolean,
  severity: OodSeverity,
  modelConfidence?: number | null
) {
  if (!isOod) {
    return typeof modelConfidence === "number" ? clamp(modelConfidence) : 0.18
  }

  if (severity === "high") {
    return 0.98
  }

  if (severity === "medium") {
    return typeof modelConfidence === "number" ? clamp(1 - modelConfidence) : 0.88
  }

  return 0.72
}

function getIngestionRecord(value: unknown) {
  if (!isRecord(value) || !isRecord(value.ingestion)) {
    return null
  }

  return value.ingestion
}

function getSequenceNames(series: unknown) {
  if (!Array.isArray(series)) {
    return []
  }

  return series
    .flatMap((item) => {
      if (!isRecord(item)) return []

      return [item.sequenceName, item.protocolName, item.seriesDescription]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map(normalizeToken)
        .filter(Boolean)
    })
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

function createCheckedAt(value?: string | Date) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function isOodReason(value: unknown): value is OodReason {
  return (
    value === "UNSUPPORTED_MODALITY" ||
    value === "UNSUPPORTED_STUDY_TYPE" ||
    value === "MISSING_STUDY_METADATA" ||
    value === "UNSUPPORTED_SEQUENCE" ||
    value === "LOW_MODEL_CONFIDENCE" ||
    value === "UNKNOWN_SCANNER" ||
    value === "OUTSIDE_TRAINING_DISTRIBUTION"
  )
}

function isOodSeverity(value: unknown): value is OodSeverity {
  return value === "low" || value === "medium" || value === "high"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}
