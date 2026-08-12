import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { createBackendAccessToken } from "../src/lib/backend-auth"


function decodePart(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>
}


test("MRI backend token is a short-lived HS256 token for the authenticated user", () => {
  const token = createBackendAccessToken("user-123", "shared-secret", 1_800_000_000)
  const [headerPart, payloadPart, signaturePart] = token.split(".")

  assert.deepEqual(decodePart(headerPart), { alg: "HS256", typ: "JWT" })
  assert.deepEqual(decodePart(payloadPart), {
    sub: "user-123",
    iat: 1_800_000_000,
    exp: 1_800_000_060,
  })
  const expected = createHmac("sha256", "shared-secret")
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64url")
  assert.equal(signaturePart, expected)
})


test("MRI backend token rejects missing identity or shared secret", () => {
  assert.throws(() => createBackendAccessToken("", "secret"), /user id/i)
  assert.throws(() => createBackendAccessToken("user-123", ""), /SECRET_KEY/)
})
