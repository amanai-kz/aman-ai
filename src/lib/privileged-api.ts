export type PrivilegedSession =
  | {
      user: {
        id: string
        role: string
        name?: string | null
      }
    }
  | null

export type PrivilegedApiSuccess<T> = {
  status: number
  body: {
    data: T
  }
}

export type PrivilegedApiFailure = {
  status: number
  body: {
    error: string
    errorKey: string
  }
}

export type PrivilegedApiResponse<T> = PrivilegedApiSuccess<T> | PrivilegedApiFailure

export class PrivilegedApiError extends Error {
  readonly status: number
  readonly errorKey: string

  constructor(errorKey: string, message: string, status: number) {
    super(message)
    this.name = "PrivilegedApiError"
    this.errorKey = errorKey
    this.status = status
  }
}

export async function requirePrivilegedActor(
  _prisma: unknown,
  session: PrivilegedSession
) {
  if (!session?.user?.id) {
    throw new PrivilegedApiError("UNAUTHENTICATED", "Authentication required", 401)
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "DOCTOR") {
    throw new PrivilegedApiError("FORBIDDEN", "Forbidden", 403)
  }

  return {
    userId: session.user.id,
    role: session.user.role as "ADMIN" | "DOCTOR",
    name: session.user.name ?? null,
  }
}

export async function requireAdminActor(session: PrivilegedSession) {
  if (!session?.user?.id) {
    throw new PrivilegedApiError("UNAUTHENTICATED", "Authentication required", 401)
  }

  if (session.user.role !== "ADMIN") {
    throw new PrivilegedApiError("FORBIDDEN", "Forbidden", 403)
  }

  return {
    userId: session.user.id,
    role: "ADMIN" as const,
    name: session.user.name ?? null,
  }
}

export function ok<T>(data: T): PrivilegedApiSuccess<T> {
  return {
    status: 200,
    body: {
      data,
    },
  }
}

export function err(status: number, errorKey: string, error: string): PrivilegedApiFailure {
  return {
    status,
    body: {
      error,
      errorKey,
    },
  }
}

export function toErrorResponse(error: unknown): PrivilegedApiFailure {
  if (error instanceof PrivilegedApiError) {
    return err(error.status, error.errorKey, error.message)
  }

  return err(500, "INTERNAL_ERROR", "Unexpected server error")
}
