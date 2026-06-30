import { createHmac, timingSafeEqual } from "node:crypto"

import { PrivilegedApiError } from "@/lib/privileged-api"

type SessionWithEmail =
  | {
      user?: {
        id?: string | null
        email?: string | null
        role?: string | null
      } | null
    }
  | null

export async function getRouteSession(
  authFn: () => Promise<SessionWithEmail>
): Promise<SessionWithEmail> {
  try {
    return await authFn()
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("outside a request scope")
    ) {
      return null
    }
    throw error
  }
}

export function verifyVapiWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string | undefined
) {
  if (!secret) return false

  const signature = headers.get("x-vapi-signature")?.replace(/^sha256=/, "")
  if (!signature) return false

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const signatureBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  if (signatureBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(signatureBuffer, expectedBuffer)
}

export async function resolveVapiPatientId(
  userId: string | null | undefined,
  query: (sql: string, params: unknown[]) => Promise<Array<{ id: string }>>
) {
  if (!userId) {
    throw new PrivilegedApiError("PATIENT_NOT_FOUND", "Patient profile not found", 400)
  }

  const rows = await query(`SELECT id FROM patients WHERE "userId" = $1`, [userId])
  const patientId = rows[0]?.id
  if (!patientId) {
    throw new PrivilegedApiError("PATIENT_NOT_FOUND", "Patient profile not found", 400)
  }
  return patientId
}

export function assertAllowedPdfRecipient(
  session: SessionWithEmail,
  recipientEmail: string
) {
  const ownEmail = session?.user?.email?.toLowerCase()
  if (!ownEmail || recipientEmail.toLowerCase() !== ownEmail) {
    throw new PrivilegedApiError(
      "FORBIDDEN",
      "PDF can only be sent to your account email",
      403
    )
  }
}
