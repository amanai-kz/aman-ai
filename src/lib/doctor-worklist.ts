import { AnalysisStatus, RiskLevel, ServiceType } from "@prisma/client"
import type { AppLocale } from "@/lib/app-locale"
import { getDoctorCopy } from "@/lib/doctor-copy"

export type DoctorWorklistPriority = "CRITICAL" | "HIGH" | "NORMAL"

export interface DoctorWorklistCase {
  id: string
  patientId: string
  patientName: string
  studyType: string
  priority: DoctorWorklistPriority
  status: string
  aiSummary: string
  updatedAt: string
  manualReviewRequired?: boolean
  abstain?: boolean
  oodReasons?: string[]
  mockSummaryKey?: "criticalMri" | "highIot" | "normalQuestionnaire"
}

const priorityOrder: Record<DoctorWorklistPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
}

export function mapRiskToPriority(riskLevel: RiskLevel | null): DoctorWorklistPriority {
  if (riskLevel === RiskLevel.CRITICAL) return "CRITICAL"
  if (riskLevel === RiskLevel.HIGH) return "HIGH"
  return "NORMAL"
}

export function sortDoctorWorklistCases(cases: DoctorWorklistCase[]): DoctorWorklistCase[] {
  return [...cases].sort((left, right) => {
    const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority]
    if (priorityDiff !== 0) {
      return priorityDiff
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  })
}

export function getPriorityLabel(priority: DoctorWorklistPriority, locale: AppLocale = "en"): string {
  const priorities = getDoctorCopy(locale).worklist.priorities
  if (priority === "CRITICAL") return priorities.critical
  if (priority === "HIGH") return priorities.high
  return priorities.normal
}

export function getPriorityClassName(priority: DoctorWorklistPriority): string {
  if (priority === "CRITICAL") {
    return "border-red-200 bg-red-500/10 text-red-700"
  }

  if (priority === "HIGH") {
    return "border-amber-200 bg-amber-500/10 text-amber-700"
  }

  return "border-emerald-200 bg-emerald-500/10 text-emerald-700"
}

export function getStatusLabel(status: string, locale: AppLocale = "en"): string {
  const statuses = getDoctorCopy(locale).worklist.statuses
  switch (status) {
    case AnalysisStatus.PENDING:
      return statuses.pending
    case AnalysisStatus.PROCESSING:
      return statuses.processing
    case AnalysisStatus.COMPLETED:
      return statuses.completed
    case AnalysisStatus.REVIEWED:
      return statuses.reviewed
    case AnalysisStatus.FAILED:
      return statuses.failed
    default:
      return status
  }
}

export function getStudyTypeLabel(studyType: string, locale: AppLocale = "en"): string {
  const studyTypes = getDoctorCopy(locale).worklist.studyTypes
  switch (studyType) {
    case ServiceType.CT_MRI:
      return studyTypes.ctMri
    case ServiceType.IOT:
      return studyTypes.iot
    case ServiceType.QUESTIONNAIRE:
      return studyTypes.questionnaire
    case ServiceType.GENETICS:
      return studyTypes.genetics
    case ServiceType.BLOOD:
      return studyTypes.blood
    case ServiceType.REHABILITATION:
      return studyTypes.rehabilitation
    default:
      return studyType
  }
}

export function getMockDoctorWorklistCases(locale: AppLocale = "ru"): DoctorWorklistCase[] {
  const summaries = getDoctorCopy(locale).worklist.mockSummaries

  return sortDoctorWorklistCases([
    {
      id: "mock-critical-mri",
      patientId: "mock-patient-1",
      patientName: "Алексей Ким",
      studyType: ServiceType.CT_MRI,
      priority: "CRITICAL",
      status: AnalysisStatus.PENDING,
      aiSummary: summaries.criticalMri,
      updatedAt: "2026-06-09T12:30:00.000Z",
      mockSummaryKey: "criticalMri",
    },
    {
      id: "mock-high-iot",
      patientId: "mock-patient-2",
      patientName: "Мария Сергеева",
      studyType: ServiceType.IOT,
      priority: "HIGH",
      status: AnalysisStatus.PROCESSING,
      aiSummary: summaries.highIot,
      updatedAt: "2026-06-09T11:10:00.000Z",
      mockSummaryKey: "highIot",
    },
    {
      id: "mock-normal-questionnaire",
      patientId: "mock-patient-3",
      patientName: "Дмитрий Павлов",
      studyType: ServiceType.QUESTIONNAIRE,
      priority: "NORMAL",
      status: AnalysisStatus.COMPLETED,
      aiSummary: summaries.normalQuestionnaire,
      updatedAt: "2026-06-08T16:45:00.000Z",
      mockSummaryKey: "normalQuestionnaire",
    },
  ])
}

export const mockDoctorWorklistCases: DoctorWorklistCase[] = getMockDoctorWorklistCases("ru")
