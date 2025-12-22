import * as crypto from 'crypto'

const SERVICE_ACCOUNT_ID = process.env.YANDEX_SERVICE_ACCOUNT_ID || ""
const KEY_ID = process.env.YANDEX_KEY_ID || ""
// Handle escaped newlines in private key from env
const PRIVATE_KEY = (process.env.YANDEX_PRIVATE_KEY || "").replace(/\\n/g, '\n')

let cachedToken: { token: string; expiresAt: number } | null = null

function base64url(data: Buffer | string): string {
  const base64 = Buffer.from(data).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createJWT(): string {
  const now = Math.floor(Date.now() / 1000)
  
  const header = {
    alg: 'PS256',
    typ: 'JWT',
    kid: KEY_ID
  }
  
  const payload = {
    iss: SERVICE_ACCOUNT_ID,
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iat: now,
    exp: now + 3600 // 1 hour
  }
  
  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const signatureInput = `${headerB64}.${payloadB64}`
  
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signatureInput)
  const signature = sign.sign({
    key: PRIVATE_KEY,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32
  })
  
  const signatureB64 = base64url(signature)
  
  return `${headerB64}.${payloadB64}.${signatureB64}`
}

export async function getIAMToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token
  }
  
  if (!SERVICE_ACCOUNT_ID || !KEY_ID || !PRIVATE_KEY) {
    console.error('Missing Yandex credentials:', {
      hasServiceAccountId: !!SERVICE_ACCOUNT_ID,
      hasKeyId: !!KEY_ID,
      hasPrivateKey: !!PRIVATE_KEY,
      privateKeyStart: PRIVATE_KEY.substring(0, 50)
    })
    throw new Error('Yandex credentials not configured')
  }
  
  console.log('Generating JWT for service account:', SERVICE_ACCOUNT_ID)
  
  const jwt = createJWT()
  
  const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ jwt })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error('IAM token error:', error)
    throw new Error('Failed to get IAM token')
  }
  
  const data = await response.json()
  
  cachedToken = {
    token: data.iamToken,
    expiresAt: Date.now() + 11 * 60 * 60 * 1000 // 11 hours
  }
  
  return data.iamToken
}

