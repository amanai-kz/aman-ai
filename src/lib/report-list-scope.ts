import { getSessionUser, type AuthzSession } from "@/lib/authz"
import { PrivilegedApiError } from "@/lib/privileged-api"

export function buildPatientScopedReportWhere(
  session: AuthzSession
): { whereSql: string; params: string[] } {
  const user = getSessionUser(session)

  if (user.role === "ADMIN") {
    return { whereSql: "", params: [] }
  }

  if (user.role === "PATIENT") {
    return {
      whereSql: ` WHERE patient_id IN (SELECT id FROM patients WHERE "userId" = $1)`,
      params: [user.id],
    }
  }

  if (user.role === "DOCTOR") {
    return {
      whereSql: ` WHERE patient_id IN (
        SELECT dp."patientId"
        FROM doctor_patients dp
        JOIN doctors d ON d.id = dp."doctorId"
        WHERE d."userId" = $1
      )`,
      params: [user.id],
    }
  }

  throw new PrivilegedApiError("FORBIDDEN", "Forbidden", 403)
}
