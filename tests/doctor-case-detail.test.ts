import assert from "node:assert/strict"
import test from "node:test"

import { AnalysisStatus, RiskLevel, ServiceType } from "@prisma/client"

import {
  buildDoctorCaseDetail,
  buildMockDoctorCaseDetail,
  getDoctorCaseAiPresentation,
} from "../src/lib/doctor-case-detail"

test("buildDoctorCaseDetail creates full radiology viewer data for CT/MRI studies", () => {
  const detail = buildDoctorCaseDetail({
    id: "analysis-1",
    patientName: "Patient A",
    patientEmail: "patient@example.com",
    studyType: ServiceType.CT_MRI,
    status: AnalysisStatus.PENDING,
    riskLevel: RiskLevel.CRITICAL,
    findings: ["Left frontal lesion", "Midline shift"],
    confidence: 0.92,
    updatedAt: new Date("2026-06-09T12:30:00.000Z"),
  })

  assert.equal(detail.viewer.mode, "radiology")
  assert.equal(detail.viewer.sequences.length, 4)
  assert.equal(detail.viewer.controls.slice.max, 96)
  assert.equal(detail.ai.findings.length, 2)
  assert.equal(detail.ai.confidenceScore, 92)
  assert.equal(detail.ai.priority, "CRITICAL")
})

test("buildDoctorCaseDetail exposes a stored segmentation mask for clinician review", () => {
  const detail = buildDoctorCaseDetail({
    id: "analysis-segmentation",
    patientName: "Patient A",
    patientEmail: "patient@example.com",
    studyType: ServiceType.CT_MRI,
    status: AnalysisStatus.COMPLETED,
    riskLevel: RiskLevel.MODERATE,
    findings: ["Model-produced segmentation region: 1.25% of the processed slice."],
    confidence: 0.86,
    segmentation: {
      maskPngBase64: "iVBORw0KGgo=",
      width: 256,
      height: 256,
      positiveAreaFraction: 0.0125,
      threshold: 0.5,
    },
    updatedAt: new Date("2026-06-09T12:30:00.000Z"),
  })

  assert.deepEqual(detail.viewer.segmentation, {
    maskPngBase64: "iVBORw0KGgo=",
    width: 256,
    height: 256,
    positiveAreaFraction: 0.0125,
    threshold: 0.5,
  })
})

test("buildDoctorCaseDetail uses unavailable viewer state for non CT/MRI studies", () => {
  const detail = buildDoctorCaseDetail({
    id: "analysis-2",
    patientName: "Patient B",
    patientEmail: "patient@example.com",
    studyType: ServiceType.IOT,
    status: AnalysisStatus.PROCESSING,
    riskLevel: RiskLevel.HIGH,
    findings: ["Sustained elevated stress"],
    confidence: 0.74,
    updatedAt: new Date("2026-06-09T11:10:00.000Z"),
  })

  assert.equal(detail.viewer.mode, "unavailable")
  assert.equal(detail.viewer.sequences.length, 0)
  assert.equal(detail.viewer.controls.slice.max, 0)
  assert.equal(detail.ai.priority, "HIGH")
})

test("buildMockDoctorCaseDetail preserves the current mock case ids and adaptive study modes", () => {
  const mriDetail = buildMockDoctorCaseDetail("mock-critical-mri")
  const iotDetail = buildMockDoctorCaseDetail("mock-high-iot")

  assert.ok(mriDetail)
  assert.ok(iotDetail)
  assert.equal(mriDetail?.viewer.mode, "radiology")
  assert.equal(iotDetail?.viewer.mode, "unavailable")
  assert.equal(iotDetail?.patientEmail, "mock@amanai.kz")
})

test("getDoctorCaseAiPresentation localizes radiology copy for the active locale", () => {
  const detail = buildDoctorCaseDetail({
    id: "analysis-3",
    patientName: "Patient C",
    patientEmail: "patient@example.com",
    studyType: ServiceType.CT_MRI,
    status: AnalysisStatus.PENDING,
    riskLevel: RiskLevel.CRITICAL,
    findings: ["Left frontal lesion", "Midline shift"],
    confidence: 0.92,
    updatedAt: new Date("2026-06-09T12:30:00.000Z"),
  })

  const ruPresentation = getDoctorCaseAiPresentation(detail, "ru")
  const kkPresentation = getDoctorCaseAiPresentation(detail, "kk")

  assert.equal(ruPresentation.generatedLabel, "Вероятная срочная нейрорадиологическая находка")
  assert.match(ruPresentation.draftFindings, /^Черновик визуального ревью:/)
  assert.equal(ruPresentation.structuredFindings[0]?.label, "Основной сигнал")
  assert.equal(kkPresentation.structuredFindings[2]?.label, "Қарау режимі")
  assert.match(
    kkPresentation.evidence[2] ?? "",
    /DICOM|PACS|қарау/
  )
})

test("getDoctorCaseAiPresentation localizes unavailable viewer guidance for non-radiology studies", () => {
  const detail = buildDoctorCaseDetail({
    id: "analysis-4",
    patientName: "Patient D",
    patientEmail: "patient@example.com",
    studyType: ServiceType.IOT,
    status: AnalysisStatus.PROCESSING,
    riskLevel: RiskLevel.HIGH,
    findings: ["Sustained elevated stress"],
    confidence: 0.74,
    updatedAt: new Date("2026-06-09T11:10:00.000Z"),
  })

  const enPresentation = getDoctorCaseAiPresentation(detail, "en")

  assert.equal(enPresentation.generatedLabel, "Physiologic trend alert")
  assert.match(enPresentation.draftFindings, /^Structured review draft:/)
  assert.equal(
    enPresentation.structuredFindings[2]?.value,
    "Viewer unavailable state active; review should rely on metadata and the AI summary."
  )
  assert.equal(
    enPresentation.evidence[1],
    "This study type does not have a radiology viewer yet; AI review remains available."
  )
})
