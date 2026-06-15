import assert from "node:assert/strict"
import test from "node:test"

import { AnalysisStatus, RiskLevel, ServiceType } from "@prisma/client"

import {
  getDoctorCaseAuditResponse,
  getDoctorCaseFindingsResponse,
  getDoctorCaseReportResponse,
  getDoctorCaseResponse,
  getDoctorCasesResponse,
  getDoctorTriageResponse,
  patchDoctorCaseReviewResponse,
} from "../src/lib/doctor-api"

type TestAnalysis = {
  id: string
  patientId: string
  serviceType: ServiceType
  status: AnalysisStatus
  riskLevel: RiskLevel
  findings: string[]
  confidence: number
  result?: Record<string, unknown> | null
  updatedAt: Date
  patient: {
    user: {
      name: string
      email: string
    }
  }
  review: {
    id: string
    doctorId: string
    verified: boolean
    findingsDraft: string
    impressionDraft: string
    workflowStatus: "DRAFT" | "EDITED" | "SIGNED"
    signedAt: Date | null
    signedById: string | null
    criticalAcknowledgedAt: Date | null
    criticalAcknowledgedById: string | null
    auditLogs: Array<{
      action: string
      actorId: string
      details: { actorName: string }
      createdAt: Date
    }>
  }
}

type TestDbOverrides = {
  doctor?: {
    findUnique?: (...args: unknown[]) => Promise<{ id: string } | null>
  }
  analysis?: {
    findMany?: (...args: unknown[]) => Promise<TestAnalysis[]>
    findFirst?: (...args: unknown[]) => Promise<TestAnalysis | null>
    findUnique?: (...args: unknown[]) => Promise<{ id: string } | null>
    update?: (...args: unknown[]) => Promise<null>
  }
  analysisReview?: {
    upsert?: (...args: unknown[]) => Promise<{ id: string }>
    findUnique?: (...args: unknown[]) => Promise<{ id: string; auditLogs: unknown[] }>
  }
  analysisReviewAuditLog?: {
    create?: (...args: unknown[]) => Promise<null>
  }
}

const doctorSession = {
  user: {
    id: "user-doctor-1",
    role: "DOCTOR",
    name: "Dr. Test",
  },
} as const

const patientSession = {
  user: {
    id: "user-patient-1",
    role: "PATIENT",
    name: "Patient Test",
  },
} as const

function buildAnalysis(overrides: Partial<TestAnalysis> = {}): TestAnalysis {
  return {
    id: "case-1",
    patientId: "patient-1",
    serviceType: ServiceType.CT_MRI,
    status: AnalysisStatus.PENDING,
    riskLevel: RiskLevel.HIGH,
    findings: ["Left frontal lesion", "Midline shift"],
    confidence: 0.91,
    result: null,
    updatedAt: new Date("2026-06-12T09:00:00.000Z"),
    patient: {
      user: {
        name: "Assigned Patient",
        email: "patient@example.com",
      },
    },
    review: {
      id: "review-1",
      doctorId: "doctor-1",
      verified: false,
      findingsDraft: "Existing findings",
      impressionDraft: "Existing impression",
      workflowStatus: "EDITED",
      signedAt: null,
      signedById: null,
      criticalAcknowledgedAt: null,
      criticalAcknowledgedById: null,
      auditLogs: [
        {
          action: "DRAFT_SAVED",
          actorId: "user-doctor-1",
          details: { actorName: "Dr. Test" },
          createdAt: new Date("2026-06-12T09:05:00.000Z"),
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
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      update: async () => null,
      ...(overrides.analysis ?? {}),
    },
    analysisReview: {
      upsert: async () => ({ id: "review-1" }),
      findUnique: async () => ({ id: "review-1", auditLogs: [] }),
      ...(overrides.analysisReview ?? {}),
    },
    analysisReviewAuditLog: {
      create: async () => null,
      ...(overrides.analysisReviewAuditLog ?? {}),
    },
  } as unknown as Parameters<typeof getDoctorCasesResponse>[0]
}

function getSuccessData<T>(response: { status: number; body: { data?: T; error?: string } }): T {
  if (!("data" in response.body)) {
    assert.fail(`expected success response, got ${response.status} ${response.body.error ?? "error"}`)
  }

  return response.body.data as T
}

test("getDoctorTriageResponse sorts assigned cases by priority and recency", async () => {
  const criticalOlder = buildAnalysis({
    id: "critical-older",
    riskLevel: RiskLevel.CRITICAL,
    updatedAt: new Date("2026-06-12T08:00:00.000Z"),
  })
  const highNewest = buildAnalysis({
    id: "high-newest",
    riskLevel: RiskLevel.HIGH,
    updatedAt: new Date("2026-06-12T10:00:00.000Z"),
  })
  const criticalNewest = buildAnalysis({
    id: "critical-newest",
    riskLevel: RiskLevel.CRITICAL,
    updatedAt: new Date("2026-06-12T11:00:00.000Z"),
  })

  const response = await getDoctorTriageResponse(
    createDb({
      analysis: {
        findMany: async () => [highNewest, criticalOlder, criticalNewest],
      },
    }),
    doctorSession
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.deepEqual(data.items.map((item) => item.id), [
    "critical-newest",
    "critical-older",
    "high-newest",
  ])
  assert.equal(data.counts.CRITICAL, 2)
})

test("doctor case APIs return 401 for unauthenticated requests", async () => {
  const response = await getDoctorCasesResponse(createDb(), null)

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, {
    error: "Authentication required",
    errorKey: "UNAUTHENTICATED",
  })
})

test("doctor case APIs return 403 for patient role", async () => {
  const response = await getDoctorCasesResponse(createDb(), patientSession)

  assert.equal(response.status, 403)
  assert.deepEqual(response.body, {
    error: "Forbidden",
    errorKey: "FORBIDDEN",
  })
})

test("doctor case detail returns 403 when the case exists but is unassigned", async () => {
  const response = await getDoctorCaseResponse(
    createDb({
      analysis: {
        findFirst: async () => null,
        findUnique: async () => ({ id: "case-1" }),
      },
    }),
    doctorSession,
    "case-1"
  )

  assert.equal(response.status, 403)
  assert.deepEqual(response.body, {
    error: "Forbidden",
    errorKey: "FORBIDDEN",
  })
})

test("doctor case detail returns 404 for a missing case", async () => {
  const response = await getDoctorCaseResponse(
    createDb({
      analysis: {
        findFirst: async () => null,
        findUnique: async () => null,
      },
    }),
    doctorSession,
    "missing-case"
  )

  assert.equal(response.status, 404)
  assert.deepEqual(response.body, {
    error: "Case not found",
    errorKey: "CASE_NOT_FOUND",
  })
})

test("review patch returns 400 for an invalid request body", async () => {
  const response = await patchDoctorCaseReviewResponse(
    createDb({
      analysis: {
        findFirst: async () => buildAnalysis(),
      },
    }),
    doctorSession,
    "case-1",
    { action: "invalid" }
  )

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    error: "Invalid request body",
    errorKey: "INVALID_BODY",
  })
})

test("review patch returns 409 when a signed report is edited", async () => {
  const response = await patchDoctorCaseReviewResponse(
    createDb({
      analysis: {
        findFirst: async () =>
          buildAnalysis({
            review: {
              ...buildAnalysis().review,
              workflowStatus: "SIGNED",
              signedAt: new Date("2026-06-12T10:00:00.000Z"),
              signedById: "user-doctor-1",
            },
          }),
      },
    }),
    doctorSession,
    "case-1",
    {
      action: "saveDraft",
      findingsDraft: "Edited after sign-off",
      impressionDraft: "Should fail",
    }
  )

  assert.equal(response.status, 409)
  assert.deepEqual(response.body, {
    error: "Signed reports are read-only",
    errorKey: "REPORT_READ_ONLY",
  })
})

test("review patch returns 409 when critical sign-off lacks acknowledgement", async () => {
  const response = await patchDoctorCaseReviewResponse(
    createDb({
      analysis: {
        findFirst: async () =>
          buildAnalysis({
            riskLevel: RiskLevel.CRITICAL,
            review: {
              ...buildAnalysis().review,
              findingsDraft: "",
              impressionDraft: "",
              workflowStatus: "DRAFT",
              auditLogs: [],
            },
          }),
      },
    }),
    doctorSession,
    "case-1",
    {
      action: "signOff",
      findingsDraft: "Needs urgent review",
      impressionDraft: "Critical finding present",
    }
  )

  assert.equal(response.status, 409)
  assert.deepEqual(response.body, {
    error: "Critical finding must be acknowledged before sign-off",
    errorKey: "CRITICAL_ACK_REQUIRED",
  })
})

test("doctor findings, report, and audit endpoints return the expected data shape", async () => {
  const db = createDb({
    analysis: {
      findFirst: async () => buildAnalysis(),
    },
  })

  const findings = await getDoctorCaseFindingsResponse(db, doctorSession, "case-1")
  const report = await getDoctorCaseReportResponse(db, doctorSession, "case-1")
  const audit = await getDoctorCaseAuditResponse(db, doctorSession, "case-1")

  assert.equal(findings.status, 200)
  const findingsData = getSuccessData(findings)
  assert.equal(findingsData.caseId, "case-1")
  assert.ok(Array.isArray(findingsData.ai.findings))
  assert.equal(typeof findingsData.reportDrafts.findingsDraft, "string")

  assert.equal(report.status, 200)
  const reportData = getSuccessData(report)
  assert.equal(reportData.caseId, "case-1")
  assert.equal(typeof reportData.isReadOnly, "boolean")
  assert.equal(typeof reportData.workflowStatus, "string")

  assert.equal(audit.status, 200)
  const auditData = getSuccessData(audit)
  assert.equal(auditData.caseId, "case-1")
  assert.ok(Array.isArray(auditData.auditLogs))
})

test("doctor findings response exposes abstention state and does not backfill AI drafts", async () => {
  const response = await getDoctorCaseFindingsResponse(
    createDb({
      analysis: {
        findFirst: async () =>
          buildAnalysis({
            findings: [],
            confidence: 0.12,
            result: {
              oodDetection: {
                isOod: true,
                manualReviewRequired: true,
                abstain: true,
                reasons: ["UNSUPPORTED_SEQUENCE", "UNKNOWN_SCANNER"],
                severity: "high",
                confidence: 0.97,
                checkedAt: "2026-06-12T10:00:00.000Z",
              },
              inferenceJob: {
                id: "infer-case-1",
                analysisId: "case-1",
                status: "COMPLETED",
                result: {
                  modelName: "aman-ood-gate",
                  modelVersion: "0.1.0-test",
                  confidence: 0.12,
                  generatedAt: "2026-06-12T10:00:00.000Z",
                  isAiGenerated: false,
                  findings: [],
                  impression: "",
                  priority: "HIGH",
                  manualReviewRequired: true,
                  abstain: true,
                  summary: "Manual review required",
                  ood: {
                    isOod: true,
                    manualReviewRequired: true,
                    abstain: true,
                    reasons: ["UNSUPPORTED_SEQUENCE", "UNKNOWN_SCANNER"],
                    severity: "high",
                    confidence: 0.97,
                    checkedAt: "2026-06-12T10:00:00.000Z",
                  },
                },
              },
            },
            review: {
              ...buildAnalysis().review,
              findingsDraft: "",
              impressionDraft: "",
              workflowStatus: "DRAFT",
              auditLogs: [],
            },
          }),
      },
    }),
    doctorSession,
    "case-1"
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.ai.manualReviewRequired, true)
  assert.equal(data.ai.abstain, true)
  assert.deepEqual(data.ai.findings, [])
  assert.ok(data.ai.ood)
  assert.deepEqual(data.reportDrafts, {
    findingsDraft: "",
    impressionDraft: "",
  })
})

test("doctor case detail returns assigned patient data for a successful doctor request", async () => {
  const response = await getDoctorCaseResponse(
    createDb({
      analysis: {
        findFirst: async () => buildAnalysis(),
      },
    }),
    doctorSession,
    "case-1"
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.case.id, "case-1")
  assert.equal(data.case.patientName, "Assigned Patient")
  assert.equal(data.case.review.workflowStatus, "EDITED")
})
