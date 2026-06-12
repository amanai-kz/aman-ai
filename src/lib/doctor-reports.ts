import type { AppLocale } from "@/lib/app-locale"
import { getAppCopy } from "@/lib/app-copy"

export function getDoctorReportsCopy(locale: AppLocale) {
  return getAppCopy(locale).doctorReports
}
