import {
  type PrivilegedApiResponse,
  type PrivilegedSession,
  PrivilegedApiError,
} from "@/lib/privileged-api"

import {
  createMockExportResult,
  getAiMetadata,
  type ExportDb,
  getPatientMetadata,
  getReportMetadata,
  getStudyMetadata,
  loadSignedReportContext,
  pacsExportRequestSchema,
  parsePacsExportId,
  toPrivilegedResponse,
  type PacsExportRequest,
  type SiteConfigStoreLike,
} from "@/lib/clinical-export-shared"

export async function createDicomResultExportResponse(
  prisma: ExportDb,
  session: PrivilegedSession,
  input: unknown,
  siteConfigStore: SiteConfigStoreLike
): Promise<
  PrivilegedApiResponse<{
    export: ReturnType<typeof buildDicomExportResponse>
  }>
> {
  return toPrivilegedResponse(async () => {
    const parsed = pacsExportRequestSchema.safeParse(input)
    if (!parsed.success) {
      throw new PrivilegedApiError("INVALID_BODY", "Invalid request body", 400)
    }

    const context = await loadSignedReportContext(
      prisma,
      session,
      parsed.data.analysisId,
      siteConfigStore
    )

    return {
      export: buildDicomExportResponse(context, parsed.data),
    }
  })
}

export function getDicomResultExportPreviewResponse(
  prisma: ExportDb,
  session: PrivilegedSession,
  id: string,
  siteConfigStore: SiteConfigStoreLike
): Promise<
  PrivilegedApiResponse<{
    export: ReturnType<typeof buildDicomExportResponse>
  }>
> {
  return toPrivilegedResponse(async () => {
    const parsedId = parsePacsExportId(id)
    const context = await loadSignedReportContext(
      prisma,
      session,
      parsedId.analysisId,
      siteConfigStore
    )

    return {
      export: buildDicomExportResponse(context, parsedId),
    }
  })
}

function buildDicomExportResponse(
  context: Awaited<ReturnType<typeof loadSignedReportContext>>,
  request: PacsExportRequest
) {
  const studyMetadata = getStudyMetadata(context.analysis)
  const patientMetadata = getPatientMetadata(context.analysis)
  const reportMetadata = getReportMetadata(context)
  const aiMetadata = getAiMetadata(context.analysis)
  const payloadPreview = {
    documentType: request.exportType,
    patient: patientMetadata,
    study: studyMetadata,
    report: reportMetadata,
    ai: aiMetadata,
    ...(request.exportType === "DICOM_SR"
      ? {
          srDocument: {
            title: "Aman AI Signed Clinical Report",
            verificationFlag: "VERIFIED",
          },
        }
      : {
          secondaryCapture: {
            caption: `Signed report preview for ${patientMetadata.name}`,
            generatedAt: reportMetadata.signedAt,
          },
        }),
  }

  const mockResult = createMockExportResult(payloadPreview)

  return {
    id: `${context.analysis.id}__${request.exportType}`,
    analysisId: context.analysis.id,
    exportType: request.exportType,
    status: mockResult.status,
    destination: {
      mode: "mock",
      endpointReference: context.siteConfig.dicomEndpoint,
    },
    preparedAt: reportMetadata.signedAt,
    deliveredAt: mockResult.deliveredAt,
    payloadPreview: mockResult.payloadPreview,
  }
}
