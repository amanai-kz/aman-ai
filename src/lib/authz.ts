import { db } from "@/lib/db"
import { PrivilegedApiError } from "@/lib/privileged-api"

/**
 * Patient-scoped authorization guards.
 *
 * The NextAuth session (see src/lib/auth.ts) only carries `user.id` and
 * `user.role` — it does NOT carry a patientId or doctorId, so those are
 * resolved from the database here. This generalizes the patient-ownership /
 * doctor-assignment checks already proven in src/lib/doctor-api.ts
 * (getAccessibleAnalysisOrThrow) and src/lib/clinical-export-shared.ts
 * (loadSignedReportContext) so the rest of the API surface can reuse a single
 * source of truth.
 *
 * Authorization model (grounded in prisma/schema.prisma):
 *   - ADMIN   -> may act on any patient.
 *   - DOCTOR  -> only patients linked via a DoctorPatient row
 *               ({ doctorId: <their Doctor.id>, patientId }).
 *   - PATIENT -> only their own record (Patient.userId === session user id).
 *
 * Guards throw {@link PrivilegedApiError}; map it to an HTTP response with
 * `toErrorResponse` from src/lib/privileged-api.ts.
 */

export type AuthzSession =
  | { user: { id: string; role: string; name?: string | null } }
  | null

export type PatientActor = {
  userId: string
  role: "ADMIN" | "DOCTOR" | "PATIENT"
  doctorId: string | null
  patientId: string
}

/**
 * The minimal Prisma surface the guards depend on. Declaring it explicitly
 * (instead of the full PrismaClient) lets unit tests inject a lightweight stub
 * without a live database.
 */
export type AuthzPrisma = {
  patient: {
    findUnique(args: {
      where: { id: string }
      select: { userId: true }
    }): Promise<{ userId: string } | null>
  }
  doctor: {
    findUnique(args: {
      where: { userId: string }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
  doctorPatient: {
    findFirst(args: {
      where: { doctorId: string; patientId: string }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
  analysis: {
    findUnique(args: {
      where: { id: string }
      select: { patientId: true }
    }): Promise<{ patientId: string | null } | null>
  }
}

const defaultPrisma = db as unknown as AuthzPrisma

/** Require an authenticated session; returns its id/role or throws 401. */
export function getSessionUser(session: AuthzSession): { id: string; role: string } {
  if (!session?.user?.id || !session.user.role) {
    throw new PrivilegedApiError("UNAUTHENTICATED", "Authentication required", 401)
  }
  return { id: session.user.id, role: session.user.role }
}

/**
 * Throw unless the caller may act on `patientId`. Returns a normalized actor
 * for downstream use.
 */
export async function assertPatientAccess(
  session: AuthzSession,
  patientId: string,
  prisma: AuthzPrisma = defaultPrisma
): Promise<PatientActor> {
  const user = getSessionUser(session)

  if (user.role === "ADMIN") {
    return { userId: user.id, role: "ADMIN", doctorId: null, patientId }
  }

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!doctor?.id) {
      throw new PrivilegedApiError(
        "DOCTOR_PROFILE_REQUIRED",
        "Doctor profile not found",
        403
      )
    }
    const link = await prisma.doctorPatient.findFirst({
      where: { doctorId: doctor.id, patientId },
      select: { id: true },
    })
    if (!link) {
      throw new PrivilegedApiError(
        "FORBIDDEN",
        "Doctor is not assigned to this patient",
        403
      )
    }
    return { userId: user.id, role: "DOCTOR", doctorId: doctor.id, patientId }
  }

  // PATIENT (and any other non-privileged role): must own the patient record.
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { userId: true },
  })
  if (!patient) {
    throw new PrivilegedApiError("PATIENT_NOT_FOUND", "Patient not found", 404)
  }
  if (patient.userId !== user.id) {
    throw new PrivilegedApiError("FORBIDDEN", "Not authorized for this patient", 403)
  }
  return { userId: user.id, role: "PATIENT", doctorId: null, patientId }
}

/**
 * Variant for records whose patientId may be null (e.g. anonymous / VAPI rows).
 * A null patientId is treated as ADMIN-only.
 */
export async function assertNullablePatientAccess(
  session: AuthzSession,
  patientId: string | null | undefined,
  prisma: AuthzPrisma = defaultPrisma
): Promise<PatientActor> {
  if (patientId == null) {
    const user = getSessionUser(session)
    if (user.role !== "ADMIN") {
      throw new PrivilegedApiError("FORBIDDEN", "Not authorized for this record", 403)
    }
    return { userId: user.id, role: "ADMIN", doctorId: null, patientId: "" }
  }
  return assertPatientAccess(session, patientId, prisma)
}

/**
 * Load an Analysis only if the caller may access its patient. Mirrors
 * doctor-api.getAccessibleAnalysisOrThrow but reusable from any route.
 */
export async function assertAnalysisAccess(
  session: AuthzSession,
  analysisId: string,
  prisma: AuthzPrisma = defaultPrisma
): Promise<{ patientId: string }> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { patientId: true },
  })
  if (!analysis?.patientId) {
    throw new PrivilegedApiError("ANALYSIS_NOT_FOUND", "Analysis not found", 404)
  }
  await assertPatientAccess(session, analysis.patientId, prisma)
  return { patientId: analysis.patientId }
}
