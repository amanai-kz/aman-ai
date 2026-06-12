import assert from "node:assert/strict"
import test from "node:test"
import { AnalysisStatus, ReviewWorkflowStatus, RiskLevel, ServiceType } from "@prisma/client"

import {
  buildManualUnsignedCriticalMriAnalysis,
  buildManualUnsignedCriticalMriReview,
  MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID,
  MANUAL_UNSIGNED_CRITICAL_MRI_CASE_URL,
} from "../prisma/seed-review-test-data"

test("manual review test seed data builds an unsigned critical MRI case", () => {
  const analysis = buildManualUnsignedCriticalMriAnalysis("patient-1")
  const review = buildManualUnsignedCriticalMriReview("doctor-1")

  assert.equal(MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID, "manual-unsigned-critical-mri")
  assert.equal(MANUAL_UNSIGNED_CRITICAL_MRI_CASE_URL, "/doctor/cases/manual-unsigned-critical-mri")

  assert.equal(analysis.patientId, "patient-1")
  assert.equal(analysis.serviceType, ServiceType.CT_MRI)
  assert.equal(analysis.status, AnalysisStatus.PENDING)
  assert.equal(analysis.riskLevel, RiskLevel.CRITICAL)
  assert.equal(analysis.confidence, 0.94)
  assert.equal(review.doctorId, "doctor-1")
  assert.equal(review.workflowStatus, ReviewWorkflowStatus.DRAFT)
  assert.equal(review.verified, false)
  assert.equal(review.signedAt, null)
  assert.equal(review.signedById, null)
  assert.equal(review.criticalAcknowledgedAt, null)
  assert.equal(review.criticalAcknowledgedById, null)
})
