import assert from "node:assert/strict"
import test from "node:test"

import {
  assertAnalysisAccess,
  assertNullablePatientAccess,
  assertPatientAccess,
  getSessionUser,
  type AuthzPrisma,
  type AuthzSession,
} from "../src/lib/authz"
import { PrivilegedApiError } from "../src/lib/privileged-api"

type FakeData = {
  patient?: { userId: string } | null
  doctor?: { id: string } | null
  link?: { id: string } | null
  analysis?: { patientId: string | null } | null
}

// Minimal in-memory stub of the Prisma surface the guards touch. Lets us assert
// the authorization logic without a live database.
function fakePrisma(data: FakeData): AuthzPrisma {
  return {
    patient: { async findUnique() { return data.patient ?? null } },
    doctor: { async findUnique() { return data.doctor ?? null } },
    doctorPatient: { async findFirst() { return data.link ?? null } },
    analysis: { async findUnique() { return data.analysis ?? null } },
  }
}

async function expectError(
  fn: () => Promise<unknown>,
  status: number,
  errorKey?: string
) {
  await assert.rejects(fn, (e: unknown) => {
    assert.ok(e instanceof PrivilegedApiError, `expected PrivilegedApiError, got ${String(e)}`)
    assert.equal(e.status, status)
    if (errorKey) assert.equal(e.errorKey, errorKey)
    return true
  })
}

const admin: AuthzSession = { user: { id: "u-admin", role: "ADMIN" } }
const doctor: AuthzSession = { user: { id: "u-doc", role: "DOCTOR" } }
const patient: AuthzSession = { user: { id: "u-pat", role: "PATIENT" } }

test("getSessionUser rejects an unauthenticated session", () => {
  assert.throws(
    () => getSessionUser(null),
    (e: unknown) => e instanceof PrivilegedApiError && e.status === 401
  )
})

test("assertPatientAccess: ADMIN may access any patient", async () => {
  const actor = await assertPatientAccess(admin, "p-1", fakePrisma({}))
  assert.equal(actor.role, "ADMIN")
})

test("assertPatientAccess: PATIENT may access their own record", async () => {
  const actor = await assertPatientAccess(
    patient,
    "p-1",
    fakePrisma({ patient: { userId: "u-pat" } })
  )
  assert.equal(actor.role, "PATIENT")
})

test("assertPatientAccess: PATIENT cannot access another patient's record (IDOR)", async () => {
  await expectError(
    () => assertPatientAccess(patient, "p-2", fakePrisma({ patient: { userId: "someone-else" } })),
    403,
    "FORBIDDEN"
  )
})

test("assertPatientAccess: PATIENT with a missing patient record -> 404", async () => {
  await expectError(
    () => assertPatientAccess(patient, "p-x", fakePrisma({ patient: null })),
    404,
    "PATIENT_NOT_FOUND"
  )
})

test("assertPatientAccess: DOCTOR assigned to the patient is allowed", async () => {
  const actor = await assertPatientAccess(
    doctor,
    "p-1",
    fakePrisma({ doctor: { id: "d-1" }, link: { id: "dp-1" } })
  )
  assert.equal(actor.role, "DOCTOR")
  assert.equal(actor.doctorId, "d-1")
})

test("assertPatientAccess: DOCTOR not assigned to the patient -> 403", async () => {
  await expectError(
    () => assertPatientAccess(doctor, "p-2", fakePrisma({ doctor: { id: "d-1" }, link: null })),
    403,
    "FORBIDDEN"
  )
})

test("assertPatientAccess: DOCTOR without a doctor profile -> 403", async () => {
  await expectError(
    () => assertPatientAccess(doctor, "p-1", fakePrisma({ doctor: null })),
    403,
    "DOCTOR_PROFILE_REQUIRED"
  )
})

test("assertPatientAccess: unauthenticated -> 401", async () => {
  await expectError(
    () => assertPatientAccess(null, "p-1", fakePrisma({})),
    401,
    "UNAUTHENTICATED"
  )
})

test("assertNullablePatientAccess: a null patientId is ADMIN-only", async () => {
  const actor = await assertNullablePatientAccess(admin, null, fakePrisma({}))
  assert.equal(actor.role, "ADMIN")
  await expectError(
    () => assertNullablePatientAccess(patient, null, fakePrisma({})),
    403,
    "FORBIDDEN"
  )
})

test("assertNullablePatientAccess: delegates to assertPatientAccess when non-null", async () => {
  await expectError(
    () => assertNullablePatientAccess(patient, "p-2", fakePrisma({ patient: { userId: "other" } })),
    403
  )
})

test("assertAnalysisAccess: missing analysis -> 404", async () => {
  await expectError(
    () => assertAnalysisAccess(doctor, "a-x", fakePrisma({ analysis: null })),
    404,
    "ANALYSIS_NOT_FOUND"
  )
})

test("assertAnalysisAccess: enforces patient access on the analysis' patient", async () => {
  await expectError(
    () =>
      assertAnalysisAccess(
        doctor,
        "a-1",
        fakePrisma({ analysis: { patientId: "p-9" }, doctor: { id: "d-1" }, link: null })
      ),
    403
  )
})
