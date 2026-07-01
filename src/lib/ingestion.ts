import { AnalysisStatus, ServiceType } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { assertPatientAccess } from "@/lib/authz"
import {
  ok,
  requirePrivilegedActor,
  toErrorResponse,
  type PrivilegedApiResponse,
  type PrivilegedSession,
  PrivilegedApiError,
} from "@/lib/privileged-api"

type IngestionDb = Pick<typeof db, "patient" | "analysis" | "doctor" | "doctorPatient">

const ingestionStudySchema = z.object({
  patientId: z.string().min(1),
  studyType: z.nativeEnum(ServiceType),
  modality: z.string().min(1),
  studyDate: z.string().datetime(),
  source: z.string().min(1),
  sourceStudyId: z.string().min(1),
  series: z
    .array(
      z.object({
        seriesInstanceUid: z.string().min(1),
        instanceCount: z.number().int().nonnegative(),
      })
    )
    .optional(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        sizeBytes: z.number().int().nonnegative().optional(),
        contentType: z.string().min(1).optional(),
      })
    )
    .optional(),
})

type IngestionStudyInput = z.infer<typeof ingestionStudySchema>

type IngestionMetadata = {
  source: string
  sourceStudyId: string
  modality: string
  studyDate: string
  series?: IngestionStudyInput["series"]
  files?: IngestionStudyInput["files"]
}

export async function createStudyIngestionResponse(
  prisma: IngestionDb,
  session: PrivilegedSession,
  input: unknown
): Promise<
  PrivilegedApiResponse<{
    study: {
      id: string
      patientId: string
      studyType: string
      modality: string
      studyDate: string
      source: string
      sourceStudyId: string
      status: string
      createdAt: string
    }
    idempotent: boolean
  }>
> {
  try {
    await requirePrivilegedActor(prisma, session)

    const parsed = ingestionStudySchema.safeParse(input)
    if (!parsed.success) {
      throw new PrivilegedApiError("INVALID_BODY", "Invalid request body", 400)
    }

    const patient = await prisma.patient.findUnique({
      where: { id: parsed.data.patientId },
      select: { id: true },
    })

    if (!patient) {
      throw new PrivilegedApiError("PATIENT_NOT_FOUND", "Patient not found", 404)
    }
    await assertPatientAccess(session, parsed.data.patientId, prisma)

    const existing = await findExistingStudy(prisma, parsed.data)
    if (existing) {
      return ok({
        study: presentStudy(existing),
        idempotent: true,
      })
    }

    const created = await prisma.analysis.create({
      data: {
        patientId: parsed.data.patientId,
        serviceType: parsed.data.studyType,
        status: AnalysisStatus.PENDING,
        findings: [],
        inputData: {
          ingestion: buildIngestionMetadata(parsed.data),
        },
      },
    })

    return ok({
      study: presentStudy(created),
      idempotent: false,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function findExistingStudy(prisma: IngestionDb, input: IngestionStudyInput) {
  const analyses = await prisma.analysis.findMany({
    where: {
      patientId: input.patientId,
      serviceType: input.studyType,
    },
    orderBy: { createdAt: "desc" },
  })

  return analyses.find((analysis) => {
    const ingestion = getIngestionMetadata(analysis.inputData)
    return (
      ingestion?.source === input.source &&
      ingestion?.sourceStudyId === input.sourceStudyId
    )
  })
}

function buildIngestionMetadata(input: IngestionStudyInput): IngestionMetadata {
  return {
    source: input.source,
    sourceStudyId: input.sourceStudyId,
    modality: input.modality,
    studyDate: input.studyDate,
    ...(input.series ? { series: input.series } : {}),
    ...(input.files ? { files: input.files } : {}),
  }
}

function presentStudy(analysis: {
  id: string
  patientId: string
  serviceType: string
  status: string
  inputData: unknown
  createdAt: Date
}) {
  const ingestion = getIngestionMetadata(analysis.inputData)

  return {
    id: analysis.id,
    patientId: analysis.patientId,
    studyType: analysis.serviceType,
    modality: ingestion?.modality ?? "",
    studyDate: ingestion?.studyDate ?? "",
    source: ingestion?.source ?? "",
    sourceStudyId: ingestion?.sourceStudyId ?? "",
    status: analysis.status,
    createdAt: analysis.createdAt.toISOString(),
  }
}

function getIngestionMetadata(inputData: unknown): IngestionMetadata | null {
  if (!inputData || typeof inputData !== "object" || !("ingestion" in inputData)) {
    return null
  }

  const ingestion = (inputData as { ingestion?: unknown }).ingestion
  if (!ingestion || typeof ingestion !== "object") {
    return null
  }

  const candidate = ingestion as Partial<IngestionMetadata>
  if (
    typeof candidate.source !== "string" ||
    typeof candidate.sourceStudyId !== "string" ||
    typeof candidate.modality !== "string" ||
    typeof candidate.studyDate !== "string"
  ) {
    return null
  }

  return {
    source: candidate.source,
    sourceStudyId: candidate.sourceStudyId,
    modality: candidate.modality,
    studyDate: candidate.studyDate,
    ...(Array.isArray(candidate.series) ? { series: candidate.series } : {}),
    ...(Array.isArray(candidate.files) ? { files: candidate.files } : {}),
  }
}
