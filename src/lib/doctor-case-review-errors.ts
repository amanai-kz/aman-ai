export type DoctorCaseReviewErrorKey =
  | "REPORT_READ_ONLY"
  | "CRITICAL_ALREADY_ACKNOWLEDGED"
  | "CRITICAL_ACK_REQUIRED"
  | "UNSUPPORTED_REVIEW_ACTION"
  | "REVIEW_PERSISTENCE_UNAVAILABLE"

export class DoctorCaseReviewError extends Error {
  readonly errorKey: DoctorCaseReviewErrorKey
  readonly status: number

  constructor(errorKey: DoctorCaseReviewErrorKey, message: string, status: number) {
    super(message)
    this.name = "DoctorCaseReviewError"
    this.errorKey = errorKey
    this.status = status
  }
}

export function isDoctorCaseReviewError(error: unknown): error is DoctorCaseReviewError {
  return error instanceof DoctorCaseReviewError
}

export function getDoctorCaseReviewErrorPayload(error: unknown) {
  if (isDoctorCaseReviewError(error)) {
    return {
      error: error.message,
      errorKey: error.errorKey,
      status: error.status,
    }
  }

  return {
    error: "Doctor review persistence is unavailable",
    errorKey: "REVIEW_PERSISTENCE_UNAVAILABLE" as const,
    status: 503,
  }
}
