import assert from "node:assert/strict"
import test from "node:test"

import { getDoctorCopy } from "../src/lib/doctor-copy"

test("getDoctorCopy returns localized worklist labels for ru, en, and kk", () => {
  assert.equal(getDoctorCopy("ru").worklist.pageTitle, "Список врача")
  assert.equal(getDoctorCopy("en").worklist.pageTitle, "Doctor worklist")
  assert.equal(getDoctorCopy("kk").worklist.pageTitle, "Дәрігер тізімі")
})

test("getDoctorCopy falls back to russian for unknown locale input", () => {
  assert.equal(getDoctorCopy("unknown").worklist.open, "Открыть")
})

test("getDoctorCopy returns localized case review labels for ru, en, and kk", () => {
  assert.equal(getDoctorCopy("ru").caseDetail.viewerTitle, "Просмотр исследования")
  assert.equal(getDoctorCopy("en").caseDetail.viewerUnavailable, "Viewer unavailable for this study type")
  assert.equal(getDoctorCopy("kk").caseDetail.aiWarningTitle, "AI нәтижесін міндетті түрде тексеріңіз")
})

test("getDoctorCopy includes localized SCRUM-34 AI review text for all supported locales", () => {
  assert.equal(
    getDoctorCopy("ru").caseDetail.generatedLabels.urgentNeuroradiologyFinding,
    "Вероятная срочная нейрорадиологическая находка"
  )
  assert.equal(
    getDoctorCopy("en").caseDetail.structuredFindingLabels.reviewMode,
    "Review mode"
  )
  assert.equal(
    getDoctorCopy("kk").caseDetail.evidenceNotes.unavailableViewer,
    "Бұл зерттеу түрі үшін радиология қарау құралы әлі жоқ, бірақ AI шолуы қолжетімді."
  )
})

test("getDoctorCopy includes localized SCRUM-35, SCRUM-32, and SCRUM-36 doctor review text", () => {
  assert.equal(getDoctorCopy("en").caseDetail.reportEditorTitle, "Report editor")
  assert.equal(getDoctorCopy("ru").caseDetail.reviewStatuses.signed, "Подписано")
  assert.equal(getDoctorCopy("kk").caseDetail.auditTimelineTitle, "Аудит тарихы")
  assert.equal(getDoctorCopy("en").caseDetail.criticalAlertTitle, "Critical finding requires acknowledgement")
  assert.equal(getDoctorCopy("ru").caseDetail.actionButtons.saveDraft, "Сохранить черновик")
  assert.equal(getDoctorCopy("kk").caseDetail.actionButtons.rejectAiDraft, "AI нобайын қабылдамау")
  assert.equal(getDoctorCopy("en").caseDetail.errorMessages.reportReadOnly, "Signed reports are read-only.")
})
