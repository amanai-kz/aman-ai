import assert from "node:assert/strict"
import test from "node:test"

import { AnalysisStatus, ServiceType } from "@prisma/client"

import {
  createClinicalReportExportResponse,
  getClinicalReportExportPreviewResponse,
} from "../src/lib/clinical-report-export"

type TestSession =
  | {
      user: {
        id: string
        role: "ADMIN" | "DOCTOR" | "PATIENT"
        name?: string | null
      }
    }
  | null

type TestAnalysis = {
  id: string
  patientId: string
  serviceType: ServiceType
  status: AnalysisStatus
  findings: string[]
  confidence: number | null
  updatedAt: Date
  inputData: Record<string, unknown> | null
  result: Record<string, unknown> | null
  patient: {
    id: string
    dateOfBirth: Date | null
    gender: string | null
    user: {
      name: string | null
      email: string | null
    }
  }
  review: null | {
    id: string
    doctorId: string
    findingsDraft: string | null
    impressionDraft: string | null
    workflowStatus: "DRAFT" | "EDITED" | "SIGNED"
    signedAt: Date | null
    signedById: string | null
    auditLogs: Array<{
      actorId: string
      details: { actorName?: string | null } | null
      createdAt: Date
    }>
  }
}

type TestDbOverrides = {
  doctor?: {
    findUnique?: (...args: unknown[]) => Promise<{ id: string } | null>
  }
  analysis?: {
    findFirst?: (...args: unknown[]) => Promise<TestAnalysis | null>
    findUnique?: (...args: unknown[]) => Promise<TestAnalysis | { id: string } | null>
  }
}

const doctorSession: TestSession = {
  user: {
    id: "user-doctor-1",
    role: "DOCTOR",
    name: "Dr. Signed",
  },
}

const patientSession: TestSession = {
  user: {
    id: "user-patient-1",
    role: "PATIENT",
    name: "Patient User",
  },
}

function buildSignedAnalysis(overrides: Partial<TestAnalysis> = {}): TestAnalysis {
  return {
    id: "analysis-1",
    patientId: "patient-1",
    serviceType: ServiceType.CT_MRI,
    status: AnalysisStatus.REVIEWED,
    findings: ["Acute left frontal signal abnormality"],
    confidence: 0.93,
    updatedAt: new Date("2026-06-12T10:00:00.000Z"),
    inputData: {
      ingestion: {
        sourceStudyId: "study-001",
        accessionNumber: "ACC-001",
        modality: "MR",
        studyDate: "2026-06-12T09:00:00.000Z",
      },
    },
    result: {
      inferenceJob: {
        result: {
          modelName: "aman-mock-radiology",
          modelVersion: "0.1.0-test",
          isAiGenerated: true,
          impression: "Priority neuroradiology review is recommended.",
        },
      },
    },
    patient: {
      id: "patient-1",
      dateOfBirth: new Date("1988-04-02T00:00:00.000Z"),
      gender: "female",
      user: {
        name: "Assigned Patient",
        email: "patient@example.com",
      },
    },
    review: {
      id: "review-1",
      doctorId: "doctor-1",
      findingsDraft: "Signed findings",
      impressionDraft: "Signed impression",
      workflowStatus: "SIGNED",
      signedAt: new Date("2026-06-12T10:05:00.000Z"),
      signedById: "user-doctor-1",
      auditLogs: [
        {
          actorId: "user-doctor-1",
          details: { actorName: "Dr. Signed" },
          createdAt: new Date("2026-06-12T10:05:00.000Z"),
        },
      ],
    },
    ...overrides,
  }
}

function createDb(overrides: TestDbOverrides = {}) {
  return {
    doctor: {
      findUnique: async () => ({ id: "doctor-1" }),
      ...(overrides.doctor ?? {}),
    },
    analysis: {
      findFirst: async () => buildSignedAnalysis(),
      findUnique: async () => buildSignedAnalysis(),
      ...(overrides.analysis ?? {}),
    },
  } as const
}

function getSuccessData<T>(response: { status: number; body: { data?: T; error?: string } }): T {
  if (!("data" in response.body)) {
    assert.fail(`expected success response, got ${response.status} ${response.body.error ?? "error"}`)
  }

  return response.body.data as T
}

test("clinical report export succeeds for a signed report with FHIR and HL7 payloads", async () => {
  const response = await createClinicalReportExportResponse(
    createDb(),
    doctorSession,
    { analysisId: "analysis-1" },
    {
      async read() {
        return {
          siteName: "Aman AI",
          dicomEndpoint: "http://localhost:8042/dicom-web",
          fhirEndpoint: "http://localhost:8080/fhir",
          inferenceEndpoint: "http://localhost:3000/api/inference/jobs",
          oidcIssuer: "http://localhost:5556",
          oidcClientId: "aman-local",
          oidcRedirectUri: "http://localhost:3000/api/auth/callback/oidc",
        }
      },
    }
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.export.status, "sent_mock")
  assert.equal(data.export.fhir.resourceType, "DiagnosticReport")
  assert.equal(data.export.fhir.conclusion, "Signed impression")
  assert.equal(data.export.hl7.messageType, "ORU^R01")
  assert.match(data.export.hl7.message, /^MSH\|/)
})

test("clinical report export returns 401 when unauthenticated", async () => {
  const response = await createClinicalReportExportResponse(
    createDb(),
    null,
    { analysisId: "analysis-1" },
    { read: async () => ({}) as never }
  )

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, {
    error: "Authentication required",
    errorKey: "UNAUTHENTICATED",
  })
})

test("clinical report export returns 403 for patient role", async () => {
  const response = await createClinicalReportExportResponse(
    createDb(),
    patientSession,
    { analysisId: "analysis-1" },
    { read: async () => ({}) as never }
  )

  assert.equal(response.status, 403)
  assert.deepEqual(response.body, {
    error: "Forbidden",
    errorKey: "FORBIDDEN",
  })
})

test("clinical report export returns 404 for a missing report", async () => {
  const response = await createClinicalReportExportResponse(
    createDb({
      analysis: {
        findFirst: async () => null,
        findUnique: async () => null,
      },
    }),
    doctorSession,
    { analysisId: "missing-analysis" },
    { read: async () => ({}) as never }
  )

  assert.equal(response.status, 404)
  assert.deepEqual(response.body, {
    error: "Case not found",
    errorKey: "CASE_NOT_FOUND",
  })
})

test("clinical report export returns 409 for unsigned reports", async () => {
  const response = await createClinicalReportExportResponse(
    createDb({
      analysis: {
        findFirst: async () =>
          buildSignedAnalysis({
            review: {
              ...buildSignedAnalysis().review!,
              workflowStatus: "EDITED",
              signedAt: null,
              signedById: null,
            },
          }),
      },
    }),
    doctorSession,
    { analysisId: "analysis-1" },
    { read: async () => ({}) as never }
  )

  assert.equal(response.status, 409)
  assert.deepEqual(response.body, {
    error: "Signed report required before export",
    errorKey: "REPORT_NOT_SIGNED",
  })
})

test("clinical report preview lookup returns deterministic FHIR and HL7 output", async () => {
  const response = await getClinicalReportExportPreviewResponse(
    createDb(),
    doctorSession,
    "analysis-1",
    {
      async read() {
        return {
          siteName: "Aman AI",
          dicomEndpoint: "http://localhost:8042/dicom-web",
          fhirEndpoint: "http://localhost:8080/fhir",
          inferenceEndpoint: "http://localhost:3000/api/inference/jobs",
          oidcIssuer: "http://localhost:5556",
          oidcClientId: "aman-local",
          oidcRedirectUri: "http://localhost:3000/api/auth/callback/oidc",
        }
      },
    }
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.export.fhir.resourceType, "DiagnosticReport")
  assert.equal(data.export.fhir.status, "final")
  assert.match(data.export.hl7.message, /\rOBX\|1\|TX\|FINDINGS/)
})
