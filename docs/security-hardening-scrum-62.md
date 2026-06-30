# SCRUM-62 Security Hardening

## Routes changed

- `POST /api/vapi/webhook`
- `POST /api/chat`
- `POST /api/speech/tts`
- `POST /api/speech/stt`
- `POST /api/pdf/send-email`

## VAPI webhook signature scheme

The webhook verifies `x-vapi-signature` as an HMAC-SHA256 hex digest of the raw request body:

```text
x-vapi-signature: sha256=<hex digest>
```

`sha256=` is optional; plain hex is also accepted. Comparison uses timing-safe equality.

Required env var:

```env
VAPI_WEBHOOK_SECRET="replace-with-vapi-webhook-secret"
```

Local unsigned testing is possible only with:

```env
VAPI_WEBHOOK_ALLOW_UNSIGNED="true"
```

That bypass is ignored in production.

## Patient ID consistency

The VAPI call metadata still carries `metadata.userId` as `User.id`. The webhook now resolves the matching `Patient.id` with:

```sql
SELECT id FROM patients WHERE "userId" = $1
```

Only `Patient.id` is inserted into `voice_reports.patient_id`. If no patient exists, the webhook returns a safe error and does not insert an orphan voice report.

## AI proxy auth

These routes now require an authenticated session before reading request payloads or calling providers:

- `/api/chat`
- `/api/speech/tts`
- `/api/speech/stt`

Unauthenticated requests return `401`.

## PDF email recipient rule

`/api/pdf/send-email` still requires auth and now only allows sending to the authenticated user's own email address. Any other recipient returns `403`.

## Tests added

- VAPI missing, invalid, and valid signature checks.
- VAPI `User.id` to `Patient.id` resolution.
- Missing patient prevents orphan voice report insert.
- AI proxy unauthenticated `401` checks.
- PDF own-email allowed and arbitrary-recipient forbidden checks.

## Production follow-ups

- Configure the real VAPI webhook secret in production.
- Keep `VAPI_WEBHOOK_ALLOW_UNSIGNED` unset or `false` in production.
