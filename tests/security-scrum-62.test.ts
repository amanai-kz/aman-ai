import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import {
  assertAllowedPdfRecipient,
  getRouteSession,
  resolveVapiPatientId,
  verifyVapiWebhookSignature,
} from "../src/lib/security-scrum-62"

const body = JSON.stringify({ message: { type: "end-of-call-report" } })
const secret = "test-vapi-secret"
const validSignature = createHmac("sha256", secret).update(body).digest("hex")

test("VAPI webhook rejects missing signature", () => {
  assert.equal(verifyVapiWebhookSignature(body, new Headers(), secret), false)
})

test("VAPI webhook rejects invalid signature", () => {
  assert.equal(
    verifyVapiWebhookSignature(body, new Headers({ "x-vapi-signature": "bad" }), secret),
    false
  )
})

test("VAPI webhook accepts valid signature", () => {
  assert.equal(
    verifyVapiWebhookSignature(
      body,
      new Headers({ "x-vapi-signature": `sha256=${validSignature}` }),
      secret
    ),
    true
  )
})

test("VAPI webhook resolves Patient.id from metadata User.id", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = []
  const patientId = await resolveVapiPatientId(
    "user-1",
    async (sql, params) => {
      queries.push({ sql, params })
      return [{ id: "patient-1" }]
    }
  )

  assert.equal(patientId, "patient-1")
  assert.deepEqual(queries[0].params, ["user-1"])
})

test("VAPI webhook rejects missing patient instead of orphan voice report", async () => {
  await assert.rejects(
    () => resolveVapiPatientId("user-missing", async () => []),
    /Patient profile not found/
  )
})

test("PDF email allows authenticated user's own email", () => {
  assert.doesNotThrow(() =>
    assertAllowedPdfRecipient(
      { user: { id: "user-1", role: "PATIENT", email: "me@example.com" } },
      "me@example.com"
    )
  )
})

test("PDF email rejects arbitrary recipient", () => {
  assert.throws(
    () =>
      assertAllowedPdfRecipient(
        { user: { id: "user-1", role: "PATIENT", email: "me@example.com" } },
        "other@example.com"
      ),
    /PDF can only be sent to your account email/
  )
})

test("route auth helper returns authenticated session", async () => {
  const session = { user: { id: "user-1", email: "me@example.com" } }
  assert.deepEqual(await getRouteSession(async () => session), session)
})
