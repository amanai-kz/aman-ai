import { z } from "zod"

import {
  err,
  ok,
  requirePrivilegedActor,
  toErrorResponse,
  type PrivilegedApiResponse,
  type PrivilegedSession,
  PrivilegedApiError,
} from "@/lib/privileged-api"

export type ExportDb = {
  analysis: {
    findFirst(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown>
  }
  doctor: {
    findUnique(args: unknown): Promise<{ id: string } | null>
  }
}

type ExportPatientRecord = {
  id: string
  dateOfBirth: Date | null
  gender: string | null
  user: {
    name: string | null
    email: string | null
  }
}

type ExportReviewAuditLog = {
  actorId: string
  details: unknown
  createdAt: Date
}

type ExportReviewRecord = {
  doctorId: string
  findingsDraft: string | null
  impressionDraft: string | null
  workflowStatus: "DRAFT" | "EDITED" | "SIGNED"
  signedAt: Date | null
  signedById: string | null
  auditLogs: ExportReviewAuditLog[]
}

type ExportAnalysisRecord = {
  id: string
  patientId: string
  serviceType: string
  status: string
  findings: string[]
  confidence: number | null
  updatedAt: Date
  inputData: unknown
  result: unknown
  patient: ExportPatientRecord
  review: ExportReviewRecord | null
}

type SiteConfigReference = {
  siteName: string
  dicomEndpoint: string
  fhirEndpoint: string
  inferenceEndpoint: string
  oidcIssuer: string
  oidcClientId: string
  oidcRedirectUri: string
}

export type SiteConfigStoreLike = {
  read(): Promise<SiteConfigReference>
}

export type ExportStatus = "prepared" | "sent_mock" | "failed"

export type SignedReportContext = {
  analysis: ExportAnalysisRecord
  actor: {
    userId: string
    role: "ADMIN" | "DOCTOR"
    name: string | null
    doctorId: string | null
    isAdmin: boolean
  }
  signedByName: string | null
  siteConfig: SiteConfigReference
}

export const pacsExportRequestSchema = z.object({
  analysisId: z.string().min(1),
  exportType: z.enum(["DICOM_SR", "SECONDARY_CAPTURE"]),
})

export const ehrExportRequestSchema = z.object({
  analysisId: z.string().min(1),
})

export type PacsExportRequest = z.infer<typeof pacsExportRequestSchema>
export type EhrExportRequest = z.infer<typeof ehrExportRequestSchema>

export async function loadSignedReportContext(
  prisma: ExportDb,
  session: PrivilegedSession,
  analysisId: string,
  siteConfigStore: SiteConfigStoreLike
): Promise<SignedReportContext> {
  const privilegedActor = await requirePrivilegedActor(prisma, session)
  const doctorId =
    privilegedActor.role === "DOCTOR"
      ? await resolveDoctorId(prisma, privilegedActor.userId)
      : null

  const analysis = await prisma.analysis.findFirst({
    where:
      privilegedActor.role === "ADMIN"
        ? { id: analysisId }
        : {
            id: analysisId,
            patient: {
              assignedDoctors: {
                some: {
                  doctorId: doctorId!,
                },
              },
            },
          },
    include: {
      patient: {
        select: {
          id: true,
          dateOfBirth: true,
          gender: true,
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

  if (!analysis) {
    const existing = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true },
    })

    if (existing) {
      throw new PrivilegedApiError("FORBIDDEN", "Forbidden", 403)
    }

    throw new PrivilegedApiError("CASE_NOT_FOUND", "Case not found", 404)
  }

  const exportAnalysis = analysis as ExportAnalysisRecord

  if (
    !exportAnalysis.review ||
    exportAnalysis.review.workflowStatus !== "SIGNED" ||
    !exportAnalysis.review.signedAt
  ) {
    throw new PrivilegedApiError(
      "REPORT_NOT_SIGNED",
      "Signed report required before export",
      409
    )
  }

  return {
    analysis: exportAnalysis,
    actor: {
      userId: privilegedActor.userId,
      role: privilegedActor.role,
      name: privilegedActor.name,
      doctorId,
      isAdmin: privilegedActor.role === "ADMIN",
    },
    signedByName: getActorNameFromAuditLogs(
      exportAnalysis.review.auditLogs as ExportReviewAuditLog[],
      exportAnalysis.review.signedById
    ),
    siteConfig: await siteConfigStore.read(),
  }
}

export function getStudyMetadata(analysis: ExportAnalysisRecord) {
  const ingestion = getIngestionRecord(analysis.inputData)
  const series = Array.isArray(ingestion?.series) ? ingestion.series : []

  return {
    sourceStudyId: stringOrNull(ingestion?.sourceStudyId) ?? analysis.id,
    accessionNumber: stringOrNull(ingestion?.accessionNumber) ?? analysis.id.toUpperCase(),
    modality: stringOrNull(ingestion?.modality) ?? analysis.serviceType,
    studyDate: stringOrNull(ingestion?.studyDate) ?? analysis.updatedAt.toISOString(),
    source: stringOrNull(ingestion?.source) ?? "local-mock",
    seriesCount: series.length,
  }
}

export function getPatientMetadata(analysis: ExportAnalysisRecord) {
  return {
    id: analysis.patient.id,
    name: analysis.patient.user.name ?? "Unknown Patient",
    dateOfBirth: analysis.patient.dateOfBirth?.toISOString() ?? null,
    gender: analysis.patient.gender ?? null,
  }
}

export function getReportMetadata(context: SignedReportContext) {
  return {
    findings: context.analysis.review?.findingsDraft?.trim() ?? "",
    impression: context.analysis.review?.impressionDraft?.trim() ?? "",
    signedAt: context.analysis.review?.signedAt?.toISOString() ?? null,
    signedBy: {
      id: context.analysis.review?.signedById ?? null,
      name: context.signedByName,
    },
    status: "final" as const,
  }
}

export function getAiMetadata(analysis: ExportAnalysisRecord) {
  const result = isRecord(analysis.result) ? analysis.result : null
  const inferenceJob = result && isRecord(result.inferenceJob) ? result.inferenceJob : null
  const inferenceResult =
    inferenceJob && isRecord(inferenceJob.result) ? inferenceJob.result : result

  return {
    isAiGenerated: booleanOrDefault(inferenceResult?.isAiGenerated, Boolean(inferenceResult)),
    modelName: stringOrNull(inferenceResult?.modelName),
    modelVersion: stringOrNull(inferenceResult?.modelVersion),
    confidence: analysis.confidence,
    findings: analysis.findings,
    impression: stringOrNull(inferenceResult?.impression),
  }
}

export function parsePacsExportId(id: string) {
  const [analysisId, exportType] = id.split("__")
  if (!analysisId || (exportType !== "DICOM_SR" && exportType !== "SECONDARY_CAPTURE")) {
    throw new PrivilegedApiError("INVALID_EXPORT_ID", "Invalid export id", 400)
  }

  return {
    analysisId,
    exportType,
  } as const
}

export function createMockExportResult<T>(payload: T) {
  return {
    status: "sent_mock" as const,
    deliveredAt: new Date().toISOString(),
    payloadPreview: payload,
  }
}

export function toPrivilegedResponse<T>(
  builder: () => Promise<T>
): Promise<PrivilegedApiResponse<T>> {
  return builder()
    .then((data) => ok(data))
    .catch((error) => toErrorResponse(error))
}

export function invalidBodyResponse() {
  return err(400, "INVALID_BODY", "Invalid request body")
}

async function resolveDoctorId(prisma: ExportDb, userId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (!doctor) {
    throw new PrivilegedApiError("DOCTOR_PROFILE_REQUIRED", "Doctor profile not found", 403)
  }

  return doctor.id
}

function getActorNameFromAuditLogs(
  logs: ExportReviewAuditLog[],
  actorId: string | null | undefined
) {
  if (!actorId) return null

  for (const log of logs) {
    if (log.actorId !== actorId || !isRecord(log.details)) {
      continue
    }

    if (typeof log.details.actorName === "string" && log.details.actorName.length > 0) {
      return log.details.actorName
    }
  }

  return null
}

function getIngestionRecord(value: unknown) {
  if (!isRecord(value)) return null
  return isRecord(value.ingestion) ? value.ingestion : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}
