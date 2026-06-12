import type { AppLocale } from "@/lib/app-locale"
import { getAppCopy } from "@/lib/app-copy"

export function getDoctorDashboardPageData(locale: AppLocale) {
  const copy = getAppCopy(locale).doctorDashboard

  return {
    ...copy,
    pendingReviews: {
      ...copy.pendingReviews,
      items: [
        { id: "1", patient: "Алексей К.", type: "CT_MRI", date: copy.timeLabels.twoHoursAgo, priority: "high" as const },
        { id: "2", patient: "Мария С.", type: "IOT", date: copy.timeLabels.fiveHoursAgo, priority: "medium" as const },
        { id: "3", patient: "Дмитрий П.", type: "QUESTIONNAIRE", date: copy.timeLabels.yesterday, priority: "low" as const },
      ],
    },
    recentPatients: {
      ...copy.recentPatients,
      items: [
        { id: "1", name: "Алексей Ким", lastVisit: copy.timeLabels.today, status: "active", analyses: 5 },
        { id: "2", name: "Мария Сергеева", lastVisit: copy.timeLabels.yesterday, status: "active", analyses: 3 },
        { id: "3", name: "Дмитрий Павлов", lastVisit: copy.timeLabels.threeDaysAgo, status: "pending", analyses: 2 },
      ],
    },
  }
}
