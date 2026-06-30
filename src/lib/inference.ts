import { AnalysisStatus, RiskLevel, ServiceType } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { assertPatientAccess } from "@/lib/authz"
import { createInMemoryJobQueue } from "@/lib/job-queue"
import { detectOutOfDistributionStudy, type OodDetectionResult } from "@/lib/ood-detection"
import {
  ok,
  requirePrivilegedActor,
  toErrorResponse,
  type PrivilegedApiResponse,
  type PrivilegedSession,
  PrivilegedApiError,
} from "@/lib/privileged-api"

type InferenceDb = Pick<typeof db, "analysis" | "patient" | "doctor" | "doctorPatient">
type InferenceQueueJob = {
  analysisId: string
}

const createInferenceJobSchema = z.object({
  analysisId: z.string().min(1),
})

type MockInferenceResult = {
  modelName: string
  modelVersion: string
  confidence: number
  generatedAt: string
  isAiGenerated: boolean
  findings: string[]
  impression: string
  priority: "NORMAL" | "HIGH" | "CRITICAL"
  manualReviewRequired: boolean
  abstain: boolean
  summary: string | null
  ood: OodDetectionResult | null
}

type InferenceJobPayload = {
  id: string
  analysisId: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  result: MockInferenceResult | null
}

const inferenceJobQueue = createInMemoryJobQueue()

export async function createInferenceJobResponse(
  prisma: InferenceDb,
  session: PrivilegedSession,
  input: unknown
): Promise<PrivilegedApiResponse<{ job: InferenceJobPayload }>> {
  try {
    await requirePrivilegedActor(prisma, session)

    const parsed = createInferenceJobSchema.safeParse(input)
    if (!parsed.success) {
      throw new PrivilegedApiError("INVALID_BODY", "Invalid request body", 400)
    }

    const analysis = await prisma.analysis.findUnique({
      where: { id: parsed.data.analysisId },
    })

    if (!analysis) {
      throw new PrivilegedApiError("ANALYSIS_NOT_FOUND", "Analysis not found", 404)
    }
    await assertPatientAccess(session, analysis.patientId, prisma)

    const existingJob = getStoredInferenceJob(analysis.result, analysis.id)
    if (existingJob?.status === "COMPLETED" && existingJob.result) {
      return ok({
        job: existingJob,
      })
    }

    const queueJobId = formatInferenceJobId(analysis.id)
    const queuedJob = inferenceJobQueue.get<InferenceQueueJob, InferenceJobPayload>(queueJobId)

    if (queuedJob?.status === "completed" && queuedJob.result && !existingJob) {
      return ok({
        job: await executeInferenceUpdate(prisma, analysis),
      })
    }

    inferenceJobQueue.enqueue<InferenceQueueJob>({
      id: queueJobId,
      type: "inference",
      payload: { analysisId: analysis.id },
    })

    const completed = await inferenceJobQueue.run<InferenceQueueJob, InferenceJobPayload>(
      queueJobId,
      async () => executeInferenceUpdate(prisma, analysis)
    )

    if (!completed.result) {
      throw new PrivilegedApiError("INFERENCE_JOB_FAILED", "Inference job failed", 500)
    }

    return ok({
      job: completed.result,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function getInferenceJobResponse(
  prisma: InferenceDb,
  session: PrivilegedSession,
  id: string
): Promise<PrivilegedApiResponse<{ job: InferenceJobPayload }>> {
  try {
    await requirePrivilegedActor(prisma, session)

    const analysisId = parseInferenceJobId(id)
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
    })

    if (!analysis) {
      throw new PrivilegedApiError("ANALYSIS_NOT_FOUND", "Analysis not found", 404)
    }
    await assertPatientAccess(session, analysis.patientId, prisma)

    const queued = inferenceJobQueue.get<InferenceQueueJob, InferenceJobPayload>(id)
    const stored = getStoredInferenceJob(analysis.result, analysis.id)
    const job =
      stored ??
      (queued ? presentQueuedInferenceJob(queued) : null) ??
      buildJobPayload(
        analysis.id,
        analysis.status === AnalysisStatus.FAILED
          ? "FAILED"
          : analysis.status === AnalysisStatus.COMPLETED || analysis.status === AnalysisStatus.REVIEWED
            ? "COMPLETED"
            : "PENDING",
        null
      )

    return ok({
      job,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

function buildDeterministicInferenceResult(analysis: {
  id: string
  serviceType: ServiceType
  updatedAt: Date
}): MockInferenceResult {
  const generatedAt = new Date(analysis.updatedAt.getTime() + 60_000).toISOString()
  const seed = `${analysis.serviceType}:${analysis.id}`
  const variant = seed
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0) % 3

  if (analysis.serviceType === ServiceType.CT_MRI) {
    return {
      modelName: "aman-mock-radiology",
      modelVersion: "0.1.0-test",
      confidence: 0.93,
      generatedAt,
      isAiGenerated: true,
      findings: ["Acute left frontal signal abnormality"],
      impression: "Priority neuroradiology review is recommended.",
      priority: "HIGH",
      manualReviewRequired: false,
      abstain: false,
      summary: null,
      ood: null,
    }
  }

  if (analysis.serviceType === ServiceType.IOT) {
    return {
      modelName: "aman-mock-iot",
      modelVersion: "0.1.0-test",
      confidence: 0.88,
      generatedAt,
      isAiGenerated: true,
      findings: ["Elevated physiologic stress trend"],
      impression: "Structured follow-up monitoring is recommended.",
      priority: variant === 0 ? "NORMAL" : "HIGH",
      manualReviewRequired: false,
      abstain: false,
      summary: null,
      ood: null,
    }
  }

  return {
    modelName: "aman-mock-generic",
    modelVersion: "0.1.0-test",
    confidence: variant === 0 ? 0.76 : variant === 1 ? 0.82 : 0.89,
    generatedAt,
    isAiGenerated: true,
    findings:
      variant === 0
        ? ["Stable physiologic trend"]
        : variant === 1
          ? ["Requires routine clinical follow-up"]
          : ["Escalated review signal detected"],
    impression:
      variant === 0
        ? "Requires scheduled follow-up"
        : variant === 1
          ? "Recommend clinician review in the standard queue."
          : "Recommend expedited clinician review.",
    priority: variant === 2 ? "CRITICAL" : variant === 1 ? "HIGH" : "NORMAL",
    manualReviewRequired: false,
    abstain: false,
    summary: null,
    ood: null,
  }
}

function buildDeterministicAbstentionResult(
  analysis: {
    updatedAt: Date
  },
  ood: OodDetectionResult
): MockInferenceResult {
  return {
    modelName: "aman-ood-gate",
    modelVersion: "0.1.0-test",
    confidence: 0.12,
    generatedAt: new Date(analysis.updatedAt.getTime() + 60_000).toISOString(),
    isAiGenerated: false,
    findings: [],
    impression: "",
    priority: "HIGH",
    manualReviewRequired: true,
    abstain: true,
    summary: "Manual review required",
    ood,
  }
}

function buildJobPayload(
  analysisId: string,
  status: InferenceJobPayload["status"],
  result: MockInferenceResult | null
): InferenceJobPayload {
  return {
    id: formatInferenceJobId(analysisId),
    analysisId,
    status,
    result,
  }
}

function getStoredInferenceJob(result: unknown, fallbackAnalysisId: string): InferenceJobPayload | null {
  if (!isRecord(result) || !("inferenceJob" in result) || !isRecord(result.inferenceJob)) {
    return null
  }

  const job = result.inferenceJob
  const resultValue = isMockInferenceResult(job.result)
    ? normalizeStoredInferenceResult(job.result)
    : isLegacyMockInferenceResult(job.result)
      ? normalizeLegacyInferenceResult(job.result)
    : isFlatInferenceJobResult(job)
      ? {
          modelName: job.modelName,
          modelVersion: job.modelVersion,
          confidence: job.confidence,
          generatedAt: job.generatedAt,
          isAiGenerated: job.isAiGenerated,
          findings: job.findings,
          impression: job.impression,
          priority: job.priority,
          manualReviewRequired: false,
          abstain: false,
          summary: null,
          ood: null,
        }
      : null

  if (
    typeof job.id !== "string" ||
    typeof job.analysisId !== "string" ||
    typeof job.status !== "string"
  ) {
    return null
  }

  return {
    id: job.id,
    analysisId: job.analysisId || fallbackAnalysisId,
    status: normalizeJobStatus(job.status),
    result: resultValue,
  }
}

function parseInferenceJobId(id: string) {
  if (!id.startsWith("infer-")) {
    throw new PrivilegedApiError("JOB_NOT_FOUND", "Inference job not found", 404)
  }

  return id.slice("infer-".length)
}

function formatInferenceJobId(analysisId: string) {
  return `infer-${analysisId}`
}

function presentQueuedInferenceJob(job: {
  id: string
  payload: { analysisId: string }
  status: "queued" | "running" | "completed" | "failed"
  result: InferenceJobPayload | null
}): InferenceJobPayload {
  if (job.result) {
    return job.result
  }

  return {
    id: job.id,
    analysisId: job.payload.analysisId,
    status:
      job.status === "failed"
        ? "FAILED"
        : job.status === "completed"
          ? "COMPLETED"
          : job.status === "running"
            ? "PROCESSING"
            : "PENDING",
    result: null,
  }
}

function mapPriorityToRiskLevel(priority: MockInferenceResult["priority"]): RiskLevel {
  if (priority === "CRITICAL") return RiskLevel.CRITICAL
  if (priority === "HIGH") return RiskLevel.HIGH
  return RiskLevel.MODERATE
}

function normalizeJobStatus(status: string): InferenceJobPayload["status"] {
  if (status === "FAILED") return "FAILED"
  if (status === "PROCESSING") return "PROCESSING"
  if (status === "COMPLETED") return "COMPLETED"
  return "PENDING"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isMockInferenceResult(value: unknown): value is MockInferenceResult {
  return (
    isRecord(value) &&
    typeof value.modelName === "string" &&
    typeof value.modelVersion === "string" &&
    typeof value.confidence === "number" &&
    typeof value.generatedAt === "string" &&
    typeof value.isAiGenerated === "boolean" &&
    Array.isArray(value.findings) &&
    value.findings.every((item) => typeof item === "string") &&
    typeof value.impression === "string" &&
    (value.priority === "NORMAL" || value.priority === "HIGH" || value.priority === "CRITICAL") &&
    typeof value.manualReviewRequired === "boolean" &&
    typeof value.abstain === "boolean" &&
    (value.summary === null || typeof value.summary === "string") &&
    (value.ood === null || isStoredOodDetection(value.ood))
  )
}

function isLegacyMockInferenceResult(
  value: unknown
): value is Omit<MockInferenceResult, "manualReviewRequired" | "abstain" | "summary" | "ood"> {
  return (
    isRecord(value) &&
    typeof value.modelName === "string" &&
    typeof value.modelVersion === "string" &&
    typeof value.confidence === "number" &&
    typeof value.generatedAt === "string" &&
    value.isAiGenerated === true &&
    Array.isArray(value.findings) &&
    value.findings.every((item) => typeof item === "string") &&
    typeof value.impression === "string" &&
    (value.priority === "NORMAL" || value.priority === "HIGH" || value.priority === "CRITICAL")
  )
}

function isFlatInferenceJobResult(value: Record<string, unknown>): value is Record<string, unknown> & MockInferenceResult {
  return (
    typeof value.modelName === "string" &&
    typeof value.modelVersion === "string" &&
    typeof value.confidence === "number" &&
    typeof value.generatedAt === "string" &&
    value.isAiGenerated === true &&
    Array.isArray(value.findings) &&
    typeof value.impression === "string" &&
    (value.priority === "NORMAL" || value.priority === "HIGH" || value.priority === "CRITICAL")
  )
}

function isStoredOodDetection(value: unknown): value is OodDetectionResult {
  return (
    isRecord(value) &&
    typeof value.isOod === "boolean" &&
    typeof value.manualReviewRequired === "boolean" &&
    typeof value.abstain === "boolean" &&
    Array.isArray(value.reasons) &&
    value.reasons.every((item) => typeof item === "string") &&
    (value.severity === "low" || value.severity === "medium" || value.severity === "high") &&
    typeof value.confidence === "number" &&
    typeof value.checkedAt === "string"
  )
}

async function executeInferenceUpdate(
  prisma: InferenceDb,
  analysis: Awaited<ReturnType<InferenceDb["analysis"]["findUnique"]>> & {
    id: string
    serviceType: ServiceType
    updatedAt: Date
    inputData: unknown
    result: unknown
    confidence: number | null
  }
) {
  const ood = detectOutOfDistributionStudy({
    serviceType: analysis.serviceType,
    inputData: analysis.inputData,
    confidence: analysis.confidence,
    checkedAt: new Date(analysis.updatedAt.getTime() + 60_000),
  })
  const result = ood.isOod
    ? buildDeterministicAbstentionResult(analysis, ood)
    : buildDeterministicInferenceResult(analysis)
  const job = buildJobPayload(analysis.id, "COMPLETED", result)

  const updated = await prisma.analysis.update({
    where: { id: analysis.id },
    data: {
      status: AnalysisStatus.COMPLETED,
      result: {
        ...(isRecord(analysis.result) ? analysis.result : {}),
        inferenceJob: job,
        oodDetection: ood,
      },
      confidence: result.confidence,
      findings: result.findings,
      riskLevel: result.manualReviewRequired ? RiskLevel.HIGH : mapPriorityToRiskLevel(result.priority),
      completedAt: new Date(result.generatedAt),
    },
  })

  return getStoredInferenceJob(updated.result, updated.id) ?? job
}

function normalizeStoredInferenceResult(value: MockInferenceResult): MockInferenceResult {
  return value
}

function normalizeLegacyInferenceResult(
  value: Omit<MockInferenceResult, "manualReviewRequired" | "abstain" | "summary" | "ood">
): MockInferenceResult {
  return {
    ...value,
    manualReviewRequired: false,
    abstain: false,
    summary: null,
    ood: null,
  }
}
