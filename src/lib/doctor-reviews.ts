import type { AppLocale } from "@/lib/app-locale"
import { getDoctorCopy } from "@/lib/doctor-copy"

export function getDoctorReviewsPageData(locale: AppLocale) {
  const copy = getDoctorCopy(locale).reviewsPage

  return {
    pageTitle: copy.pageTitle,
    pendingHeading: copy.pendingHeading,
    attentionSummary: copy.attentionSummary,
    priorityLegend: copy.priorityLegend,
    aiConclusion: copy.aiConclusion,
    confidence: copy.confidence,
    details: copy.details,
    comment: copy.comment,
    reject: copy.reject,
    confirm: copy.confirm,
    ageSuffix: copy.ageSuffix,
    allReviewedTitle: copy.allReviewedTitle,
    allReviewedDescription: copy.allReviewedDescription,
    reviews: [
      {
        id: "1",
        patient: { name: "Алексей Ким", age: 45 },
        type: "CT_MRI",
        title: copy.mockCases.brainMriTitle,
        date: copy.timeLabels.twoHoursAgo,
        priority: "high" as const,
        aiConfidence: 0.92,
        aiResult: copy.mockCases.brainMriResult,
        findings: copy.mockCases.brainMriFindings,
      },
      {
        id: "2",
        patient: { name: "Мария Сергеева", age: 38 },
        type: "IOT",
        title: copy.mockCases.iotMonitoringTitle,
        date: copy.timeLabels.fiveHoursAgo,
        priority: "medium" as const,
        aiConfidence: 0.87,
        aiResult: copy.mockCases.iotResult,
        findings: copy.mockCases.iotFindings,
      },
      {
        id: "3",
        patient: { name: "Дмитрий Павлов", age: 52 },
        type: "QUESTIONNAIRE",
        title: copy.mockCases.questionnaireTitle,
        date: copy.timeLabels.yesterday,
        priority: "low" as const,
        aiConfidence: 0.95,
        aiResult: copy.mockCases.questionnaireResult,
        findings: copy.mockCases.questionnaireFindings,
      },
    ],
  }
}
