import assert from "node:assert/strict"
import test from "node:test"

import { AnalysisStatus, ServiceType } from "@prisma/client"

import { createInferenceJobResponse, getInferenceJobResponse } from "../src/lib/inference"
import { createStudyIngestionResponse } from "../src/lib/ingestion"

type TestDb = Parameters<typeof createStudyIngestionResponse>[0] &
  Parameters<typeof createInferenceJobResponse>[0]

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
  inputData: Record<string, unknown> | null
  fileUrl: string | null
  result: Record<string, unknown> | null
  confidence: number | null
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | null
  findings: string[]
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

type TestDbOverrides = {
  patient?: {
    findUnique?: (...args: unknown[]) => Promise<{ id: string } | null>
  }
  analysis?: {
    findMany?: (...args: unknown[]) => Promise<TestAnalysis[]>
    findUnique?: (...args: unknown[]) => Promise<TestAnalysis | null>
    create?: (...args: unknown[]) => Promise<TestAnalysis>
    update?: (...args: unknown[]) => Promise<TestAnalysis>
  }
}

const adminSession: TestSession = {
  user: {
    id: "admin-1",
    role: "ADMIN",
    name: "Admin User",
  },
}

const doctorSession: TestSession = {
  user: {
    id: "doctor-1",
    role: "DOCTOR",
    name: "Dr. Test",
  },
}

const patientSession: TestSession = {
  user: {
    id: "patient-user-1",
    role: "PATIENT",
    name: "Patient User",
  },
}

function buildAnalysis(overrides: Partial<TestAnalysis> = {}): TestAnalysis {
  return {
    id: "analysis-1",
    patientId: "patient-1",
    serviceType: ServiceType.CT_MRI,
    status: AnalysisStatus.PENDING,
    inputData: {
      ingestion: {
        source: "dicomweb",
        sourceStudyId: "study-001",
        modality: "MR",
        studyDate: "2026-06-12T09:00:00.000Z",
      },
    },
    fileUrl: null,
    result: null,
    confidence: null,
    riskLevel: null,
    findings: [],
    createdAt: new Date("2026-06-12T09:00:00.000Z"),
    updatedAt: new Date("2026-06-12T09:00:00.000Z"),
    completedAt: null,
    ...overrides,
  }
}

function createDb(overrides: TestDbOverrides = {}) {
  return {
    patient: {
      findUnique: async () => ({ id: "patient-1" }),
      ...(overrides.patient ?? {}),
    },
    analysis: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => buildAnalysis(),
      update: async () => buildAnalysis(),
      ...(overrides.analysis ?? {}),
    },
  } as unknown as TestDb
}

function getSuccessData<T>(response: { status: number; body: { data?: T; error?: string } }): T {
  if (!("data" in response.body)) {
    assert.fail(`expected success response, got ${response.status} ${response.body.error ?? "error"}`)
  }

  return response.body.data as T
}

test("ingestion succeeds for admin and stores normalized study metadata", async () => {
  const response = await createStudyIngestionResponse(
    createDb(),
    adminSession,
    {
      patientId: "patient-1",
      studyType: "CT_MRI",
      modality: "MR",
      studyDate: "2026-06-12T09:00:00.000Z",
      source: "dicomweb",
      sourceStudyId: "study-001",
      series: [{ seriesInstanceUid: "series-1", instanceCount: 42 }],
      files: [{ fileName: "study1.dcm", sizeBytes: 1024 }],
    }
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.study.id, "analysis-1")
  assert.equal(data.study.studyType, "CT_MRI")
  assert.equal(data.study.modality, "MR")
  assert.equal(data.idempotent, false)
})

test("ingestion returns 400 for invalid request bodies", async () => {
  const response = await createStudyIngestionResponse(createDb(), adminSession, {
    patientId: "patient-1",
    modality: "MR",
    source: "dicomweb",
  })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    error: "Invalid request body",
    errorKey: "INVALID_BODY",
  })
})

test("ingestion returns 401 for unauthenticated requests", async () => {
  const response = await createStudyIngestionResponse(createDb(), null, {
    patientId: "patient-1",
    studyType: "CT_MRI",
    modality: "MR",
    studyDate: "2026-06-12T09:00:00.000Z",
    source: "dicomweb",
    sourceStudyId: "study-001",
  })

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, {
    error: "Authentication required",
    errorKey: "UNAUTHENTICATED",
  })
})

test("ingestion returns 403 for patient role", async () => {
  const response = await createStudyIngestionResponse(createDb(), patientSession, {
    patientId: "patient-1",
    studyType: "CT_MRI",
    modality: "MR",
    studyDate: "2026-06-12T09:00:00.000Z",
    source: "dicomweb",
    sourceStudyId: "study-001",
  })

  assert.equal(response.status, 403)
  assert.deepEqual(response.body, {
    error: "Forbidden",
    errorKey: "FORBIDDEN",
  })
})

test("ingestion is idempotent for the same source and sourceStudyId", async () => {
  const existing = buildAnalysis()

  const response = await createStudyIngestionResponse(
    createDb({
      analysis: {
        findMany: async () => [existing],
      },
    }),
    doctorSession,
    {
      patientId: "patient-1",
      studyType: "CT_MRI",
      modality: "MR",
      studyDate: "2026-06-12T09:00:00.000Z",
      source: "dicomweb",
      sourceStudyId: "study-001",
    }
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.idempotent, true)
  assert.equal(data.study.id, "analysis-1")
})

test("inference job creation returns deterministic mock model output", async () => {
  const response = await createInferenceJobResponse(
    createDb({
      analysis: {
        findUnique: async () => buildAnalysis(),
        update: async () =>
          buildAnalysis({
            status: AnalysisStatus.COMPLETED,
            confidence: 0.93,
            findings: ["Acute left frontal signal abnormality"],
            riskLevel: "HIGH",
            completedAt: new Date("2026-06-12T10:00:00.000Z"),
            result: {
              modelName: "aman-mock-radiology",
              modelVersion: "0.1.0-test",
            },
          }),
      },
    }),
    doctorSession,
    {
      analysisId: "analysis-1",
    }
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.job.analysisId, "analysis-1")
  assert.equal(data.job.status, "COMPLETED")
  assert.ok(data.job.result)
  assert.equal(data.job.result.modelName, "aman-mock-radiology")
  assert.equal(data.job.result.modelVersion, "0.1.0-test")
  assert.equal(data.job.result.isAiGenerated, true)
})

test("inference job status returns persisted deterministic result", async () => {
  const completed = buildAnalysis({
    status: AnalysisStatus.COMPLETED,
    confidence: 0.88,
    findings: ["Stable physiologic trend"],
    riskLevel: "MODERATE",
    completedAt: new Date("2026-06-12T10:00:00.000Z"),
    result: {
      inferenceJob: {
        id: "infer-analysis-1",
        status: "COMPLETED",
        analysisId: "analysis-1",
        result: {
          modelName: "aman-mock-generic",
          modelVersion: "0.1.0-test",
          confidence: 0.88,
          generatedAt: "2026-06-12T10:00:00.000Z",
          isAiGenerated: true,
          findings: ["Stable physiologic trend"],
          impression: "Requires scheduled follow-up",
          priority: "NORMAL",
        },
      },
    },
  })

  const response = await getInferenceJobResponse(
    createDb({
      analysis: {
        findUnique: async () => completed,
      },
    }),
    adminSession,
    "infer-analysis-1"
  )

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.job.id, "infer-analysis-1")
  assert.equal(data.job.status, "COMPLETED")
  assert.ok(data.job.result)
  assert.equal(data.job.result.modelName, "aman-mock-generic")
  assert.equal(data.job.result.generatedAt, "2026-06-12T10:00:00.000Z")
})

test("inference returns 403 for patient role", async () => {
  const response = await createInferenceJobResponse(createDb(), patientSession, {
    analysisId: "analysis-1",
  })

  assert.equal(response.status, 403)
  assert.deepEqual(response.body, {
    error: "Forbidden",
    errorKey: "FORBIDDEN",
  })
})

test("inference returns 401 for unauthenticated requests", async () => {
  const response = await createInferenceJobResponse(createDb(), null, {
    analysisId: "analysis-1",
  })

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, {
    error: "Authentication required",
    errorKey: "UNAUTHENTICATED",
  })
})

test("inference returns 404 for a missing analysis", async () => {
  const response = await createInferenceJobResponse(
    createDb({
      analysis: {
        findUnique: async () => null,
      },
    }),
    doctorSession,
    {
      analysisId: "missing-analysis",
    }
  )

  assert.equal(response.status, 404)
  assert.deepEqual(response.body, {
    error: "Analysis not found",
    errorKey: "ANALYSIS_NOT_FOUND",
  })
})
