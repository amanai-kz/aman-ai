import assert from "node:assert/strict"
import test from "node:test"

import { getAppCopy } from "../src/lib/app-copy"
import { getDashboardNavigation } from "../src/lib/dashboard-navigation"
import { getDoctorDashboardPageData } from "../src/lib/doctor-dashboard"
import { getDoctorReportsCopy } from "../src/lib/doctor-reports"
import { getDoctorReviewsPageData } from "../src/lib/doctor-reviews"
import { getLocalizedServices } from "../src/lib/services"

test("doctor reviews page data localizes visible EN RU and KK strings", () => {
  const enPage = getDoctorReviewsPageData("en")
  const ruPage = getDoctorReviewsPageData("ru")
  const kkPage = getDoctorReviewsPageData("kk")

  assert.equal(enPage.pageTitle, "Case reviews")
  assert.equal(enPage.pendingHeading, "Pending review")
  assert.equal(enPage.reviews[0]?.title, "Brain MRI")
  assert.equal(ruPage.pageTitle, "Проверка анализов")
  assert.equal(kkPage.priorityLegend.low, "Төмен")
  assert.ok(!/Проверка|Ожидают|Подтвердить/.test(JSON.stringify(enPage)))
})

test("shared navigation labels follow the selected locale", () => {
  const doctorNav = getDashboardNavigation("DOCTOR", "en")
  const patientNav = getDashboardNavigation("PATIENT", "kk")

  assert.equal(doctorNav.primary[0]?.name, "Dashboard")
  assert.equal(doctorNav.primary[3]?.name, "Review queue")
  assert.equal(patientNav.primary[0]?.name, "Басты бет")
  assert.ok(patientNav.primary.some((item) => item.name === "Тарих"))
})

test("localized services return translated catalog entries", () => {
  const enServices = getLocalizedServices("en")
  const kkServices = getLocalizedServices("kk")

  assert.equal(
    enServices.find((service) => service.id === "questionnaire")?.title,
    "Life history"
  )
  assert.equal(
    kkServices.find((service) => service.id === "reports")?.title,
    "Есептер"
  )
})

test("app copy exposes localized auth and admin labels", () => {
  const enCopy = getAppCopy("en")
  const kkCopy = getAppCopy("kk")

  assert.equal(enCopy.auth.login.title, "Sign in")
  assert.equal(enCopy.adminUsers.tableHeaders.created, "Created")
  assert.equal(kkCopy.doctorSettings.save, "Сақтау")
})

test("doctor dashboard data localizes visible EN RU and KK text", () => {
  const enPage = getDoctorDashboardPageData("en")
  const ruPage = getDoctorDashboardPageData("ru")
  const kkPage = getDoctorDashboardPageData("kk")

  assert.equal(enPage.pageTitle, "Doctor dashboard")
  assert.equal(enPage.actions.reports, "Create report")
  assert.equal(ruPage.pendingReviews.heading, "Ожидают проверки")
  assert.equal(kkPage.recentPatients.heading, "Соңғы пациенттер")
  assert.ok(!/Добрый день|Проверить анализы|Ожидают проверки/.test(JSON.stringify(enPage)))
})

test("doctor reports copy localizes visible EN RU and KK text", () => {
  const enPage = getDoctorReportsCopy("en")
  const ruPage = getDoctorReportsCopy("ru")
  const kkPage = getDoctorReportsCopy("kk")

  assert.equal(enPage.pageTitle, "Patient reports")
  assert.equal(enPage.heading, "AI voice reports")
  assert.equal(enPage.emptyTitle, "No reports yet")
  assert.equal(ruPage.searchPlaceholder, "Поиск...")
  assert.equal(kkPage.download, "Жүктеу")
  assert.ok(!/Пациент есептері|AI Голосовые есептер|Әзірше есептер жоқ/.test(JSON.stringify(enPage)))
})
