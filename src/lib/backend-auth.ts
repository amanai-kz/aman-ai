import { createHmac } from "node:crypto"


function encodeJson(value: Record<string, string | number>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}


/** Create the short-lived JWT used by authenticated server routes to call FastAPI. */
export function createBackendAccessToken(
  userId: string,
  secret = process.env.SECRET_KEY ?? "",
  issuedAtSeconds = Math.floor(Date.now() / 1000)
) {
  if (!userId) throw new Error("Backend token user id is required")
  if (!secret) throw new Error("SECRET_KEY is required for backend authentication")

  const header = encodeJson({ alg: "HS256", typ: "JWT" })
  const payload = encodeJson({
    sub: userId,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + 60,
  })
  const unsigned = `${header}.${payload}`
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url")
  return `${unsigned}.${signature}`
}
