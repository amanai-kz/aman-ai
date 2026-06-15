import {
  type PrivilegedApiResponse,
  type PrivilegedSession,
  PrivilegedApiError,
} from "@/lib/privileged-api"

import {
  createMockExportResult,
  ehrExportRequestSchema,
  type ExportDb,
  getAiMetadata,
  getPatientMetadata,
  getReportMetadata,
  getStudyMetadata,
  loadSignedReportContext,
  toPrivilegedResponse,
  type SiteConfigStoreLike,
} from "@/lib/clinical-export-shared"

export function createClinicalReportExportResponse(
  prisma: ExportDb,
  session: PrivilegedSession,
  input: unknown,
  siteConfigStore: SiteConfigStoreLike
): Promise<
  PrivilegedApiResponse<{
    export: ReturnType<typeof buildClinicalReportExportResponse>
  }>
> {
  return toPrivilegedResponse(async () => {
    const parsed = ehrExportRequestSchema.safeParse(input)
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
      export: buildClinicalReportExportResponse(context),
    }
  })
}

export function getClinicalReportExportPreviewResponse(
  prisma: ExportDb,
  session: PrivilegedSession,
  analysisId: string,
  siteConfigStore: SiteConfigStoreLike
): Promise<
  PrivilegedApiResponse<{
    export: ReturnType<typeof buildClinicalReportExportResponse>
  }>
> {
  return toPrivilegedResponse(async () => {
    const context = await loadSignedReportContext(prisma, session, analysisId, siteConfigStore)

    return {
      export: buildClinicalReportExportResponse(context),
    }
  })
}

function buildClinicalReportExportResponse(
  context: Awaited<ReturnType<typeof loadSignedReportContext>>
) {
  const patient = getPatientMetadata(context.analysis)
  const study = getStudyMetadata(context.analysis)
  const report = getReportMetadata(context)
  const ai = getAiMetadata(context.analysis)
  const fhir = {
    resourceType: "DiagnosticReport",
    id: context.analysis.id,
    status: report.status,
    code: {
      text: context.analysis.serviceType,
    },
    subject: {
      reference: `Patient/${patient.id}`,
      display: patient.name,
    },
    effectiveDateTime: study.studyDate,
    issued: report.signedAt,
    performer: report.signedBy.name
      ? [{ display: report.signedBy.name }]
      : [],
    conclusion: report.impression,
    extension: [
      {
        url: "https://amanai.kz/fhir/StructureDefinition/ai-generated",
        valueBoolean: ai.isAiGenerated,
      },
      ...(ai.modelName
        ? [
            {
              url: "https://amanai.kz/fhir/StructureDefinition/ai-model-name",
              valueString: ai.modelName,
            },
          ]
        : []),
      ...(ai.modelVersion
        ? [
            {
              url: "https://amanai.kz/fhir/StructureDefinition/ai-model-version",
              valueString: ai.modelVersion,
            },
          ]
        : []),
    ],
    presentedForm: [
      {
        contentType: "text/plain",
        title: "Findings",
        data: report.findings,
      },
    ],
  }
  const hl7Message = [
    `MSH|^~\\&|AMANAI|AMAN|RIS|HOSPITAL|${formatHl7Timestamp(report.signedAt)}||ORU^R01|${context.analysis.id}|P|2.5.1`,
    `PID|1||${patient.id}||${patient.name.replace(/\|/g, " ")}`,
    `OBR|1|${study.accessionNumber}|${study.sourceStudyId}|${context.analysis.serviceType}|||${study.studyDate}`,
    `OBX|1|TX|FINDINGS||${report.findings.replace(/\r?\n/g, "\\.br\\")}|`,
    `OBX|2|TX|IMPRESSION||${report.impression.replace(/\r?\n/g, "\\.br\\")}|`,
  ].join("\r")
  const hl7 = {
    messageType: "ORU^R01",
    version: "2.5.1",
    message: hl7Message,
  }
  const mockResult = createMockExportResult({
    fhir,
    hl7,
  })

  return {
    id: context.analysis.id,
    analysisId: context.analysis.id,
    status: mockResult.status,
    destination: {
      mode: "mock",
      endpointReference: context.siteConfig.fhirEndpoint,
    },
    deliveredAt: mockResult.deliveredAt,
    fhir: mockResult.payloadPreview.fhir,
    hl7: mockResult.payloadPreview.hl7,
  }
}

function formatHl7Timestamp(value: string | null) {
  if (!value) {
    return "19700101000000"
  }

  return value.replace(/[-:TZ.]/g, "").slice(0, 14)
}
