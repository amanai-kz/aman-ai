import { DoctorCaseReviewError } from "@/lib/doctor-case-review-errors"

export type ReviewWorkflowStatus = "DRAFT" | "EDITED" | "SIGNED"

export type ReviewAuditAction =
  | "AI_DRAFT_VIEWED"
  | "REPORT_EDITED"
  | "DRAFT_SAVED"
  | "AI_DRAFT_ACCEPTED"
  | "AI_DRAFT_REJECTED"
  | "REPORT_SIGNED_OFF"
  | "CRITICAL_FINDING_ACKNOWLEDGED"

export interface DoctorCaseReviewState {
  findingsDraft: string
  impressionDraft: string
  workflowStatus: ReviewWorkflowStatus
  signedAt: string | null
  signedById: string | null
  signedByName: string | null
  criticalAcknowledgedAt: string | null
  criticalAcknowledgedById: string | null
  criticalAcknowledgedByName: string | null
  isLocked: boolean
}

export interface DoctorCaseAuditLog {
  action: ReviewAuditAction
  actorId: string
  actorName?: string | null
  details?: Record<string, unknown> | null
  createdAt: string
}

export interface ReviewActorInput {
  actorId: string
  actorName?: string | null
  at: string
}

export interface ReviewDraftInput {
  findingsDraft: string
  impressionDraft: string
}

export function createTimestamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp")
  }

  return date.toISOString()
}

export function createReviewState(
  input: Partial<Omit<DoctorCaseReviewState, "isLocked">> = {}
): DoctorCaseReviewState {
  const workflowStatus = input.workflowStatus ?? "DRAFT"

  return {
    findingsDraft: input.findingsDraft ?? "",
    impressionDraft: input.impressionDraft ?? "",
    workflowStatus,
    signedAt: input.signedAt ?? null,
    signedById: input.signedById ?? null,
    signedByName: input.signedByName ?? null,
    criticalAcknowledgedAt: input.criticalAcknowledgedAt ?? null,
    criticalAcknowledgedById: input.criticalAcknowledgedById ?? null,
    criticalAcknowledgedByName: input.criticalAcknowledgedByName ?? null,
    isLocked: workflowStatus === "SIGNED",
  }
}

export function saveReviewDraft(
  review: DoctorCaseReviewState,
  draft: ReviewDraftInput
): DoctorCaseReviewState {
  assertReviewEditable(review)

  const findingsDraft = draft.findingsDraft.trim()
  const impressionDraft = draft.impressionDraft.trim()
  const hasContent = findingsDraft.length > 0 || impressionDraft.length > 0

  return {
    ...review,
    findingsDraft,
    impressionDraft,
    workflowStatus: hasContent ? "EDITED" : review.workflowStatus,
  }
}

export function acceptAiDraft(
  review: DoctorCaseReviewState,
  draft: ReviewDraftInput
): DoctorCaseReviewState {
  assertReviewEditable(review)

  return {
    ...review,
    findingsDraft: draft.findingsDraft.trim(),
    impressionDraft: draft.impressionDraft.trim(),
    workflowStatus: "DRAFT",
  }
}

export function rejectAiDraft(review: DoctorCaseReviewState): DoctorCaseReviewState {
  assertReviewEditable(review)

  return {
    ...review,
    findingsDraft: "",
    impressionDraft: "",
    workflowStatus: "EDITED",
  }
}

export function signOffReview(
  review: DoctorCaseReviewState,
  actor: ReviewActorInput
): DoctorCaseReviewState {
  assertReviewEditable(review)

  return {
    ...review,
    workflowStatus: "SIGNED",
    signedAt: createTimestamp(actor.at),
    signedById: actor.actorId,
    signedByName: actor.actorName ?? null,
    isLocked: true,
  }
}

export function acknowledgeCriticalFinding(
  review: DoctorCaseReviewState,
  actor: ReviewActorInput
): DoctorCaseReviewState {
  if (review.criticalAcknowledgedAt) {
    throw new DoctorCaseReviewError(
      "CRITICAL_ALREADY_ACKNOWLEDGED",
      "Critical finding is already acknowledged",
      409
    )
  }

  return {
    ...review,
    criticalAcknowledgedAt: createTimestamp(actor.at),
    criticalAcknowledgedById: actor.actorId,
    criticalAcknowledgedByName: actor.actorName ?? null,
  }
}

export function appendAuditLog(
  logs: DoctorCaseAuditLog[],
  log: DoctorCaseAuditLog
): DoctorCaseAuditLog[] {
  return [...logs, { ...log, createdAt: createTimestamp(log.createdAt) }].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
  )
}

function assertReviewEditable(review: DoctorCaseReviewState) {
  if (review.workflowStatus === "SIGNED" || review.isLocked) {
    throw new DoctorCaseReviewError("REPORT_READ_ONLY", "Signed reports are read-only", 409)
  }
}
