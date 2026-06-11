import assert from "node:assert/strict"
import test from "node:test"

import {
  acknowledgeCriticalFinding,
  appendAuditLog,
  createReviewState,
  createTimestamp,
  saveReviewDraft,
  signOffReview,
} from "../src/lib/doctor-case-review"
import {
  DoctorCaseReviewError,
  getDoctorCaseReviewErrorPayload,
} from "../src/lib/doctor-case-review-errors"

test("signOffReview marks the report as signed and locks further edits", () => {
  const review = createReviewState({
    findingsDraft: "Initial findings",
    impressionDraft: "Initial impression",
  })

  const signed = signOffReview(review, {
    actorId: "doctor-1",
    actorName: "Dr. Test",
    at: createTimestamp("2026-06-11T10:00:00.000Z"),
  })

  assert.equal(signed.workflowStatus, "SIGNED")
  assert.equal(signed.isLocked, true)
  assert.equal(signed.signedById, "doctor-1")
  assert.equal(signed.signedByName, "Dr. Test")
  assert.equal(signed.signedAt, "2026-06-11T10:00:00.000Z")

  assert.throws(
    () =>
      saveReviewDraft(signed, {
        findingsDraft: "Edited after sign-off",
        impressionDraft: "Should not save",
      }),
    (error: unknown) =>
      error instanceof DoctorCaseReviewError &&
      error.errorKey === "REPORT_READ_ONLY" &&
      error.status === 409
  )
})

test("appendAuditLog preserves newest-last ordering", () => {
  const logs = appendAuditLog(
    appendAuditLog([], {
      action: "AI_DRAFT_VIEWED",
      actorId: "doctor-1",
      createdAt: createTimestamp("2026-06-11T09:00:00.000Z"),
    }),
    {
      action: "DRAFT_SAVED",
      actorId: "doctor-1",
      createdAt: createTimestamp("2026-06-11T09:05:00.000Z"),
    }
  )

  assert.deepEqual(
    logs.map((log) => log.action),
    ["AI_DRAFT_VIEWED", "DRAFT_SAVED"]
  )
})

test("acknowledgeCriticalFinding records the acknowledgement state once", () => {
  const review = createReviewState()
  const acknowledged = acknowledgeCriticalFinding(review, {
    actorId: "doctor-2",
    actorName: "Dr. Critical",
    at: createTimestamp("2026-06-11T11:30:00.000Z"),
  })

  assert.equal(acknowledged.criticalAcknowledgedById, "doctor-2")
  assert.equal(acknowledged.criticalAcknowledgedByName, "Dr. Critical")
  assert.equal(acknowledged.criticalAcknowledgedAt, "2026-06-11T11:30:00.000Z")

  assert.throws(
    () =>
      acknowledgeCriticalFinding(acknowledged, {
        actorId: "doctor-3",
        actorName: "Dr. Duplicate",
        at: createTimestamp("2026-06-11T11:31:00.000Z"),
      }),
    (error: unknown) =>
      error instanceof DoctorCaseReviewError &&
      error.errorKey === "CRITICAL_ALREADY_ACKNOWLEDGED" &&
      error.status === 409
  )
})

test("review route error payload maps signed reports to a non-503 conflict", () => {
  const payload = getDoctorCaseReviewErrorPayload(
    new DoctorCaseReviewError("REPORT_READ_ONLY", "Signed reports are read-only", 409)
  )

  assert.deepEqual(payload, {
    error: "Signed reports are read-only",
    errorKey: "REPORT_READ_ONLY",
    status: 409,
  })
})
