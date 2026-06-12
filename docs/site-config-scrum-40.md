# SCRUM-40 Site Config and SSO Foundation

## Endpoints

- `GET /api/admin/site-config`
- `PATCH /api/admin/site-config`

## Auth Rules

- Unauthenticated requests return `401`.
- `DOCTOR` and `PATIENT` users return `403`.
- `ADMIN` users can read and update the safe site configuration.

## Managed Fields

- `siteName`
- `dicomEndpoint`
- `fhirEndpoint`
- `inferenceEndpoint`
- `oidcIssuer`
- `oidcClientId`
- `oidcRedirectUri`

## Security Notes

- Client secrets are intentionally not part of this API or storage format.
- The API returns only the fields above.
- There is no secret logging and no secret persistence path in this foundation.

## Curl Examples

```bash
curl http://localhost:3000/api/admin/site-config \
  -H "Cookie: next-auth.session-token=<admin-token>"
```

```bash
curl -X PATCH http://localhost:3000/api/admin/site-config \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<admin-token>" \
  -d '{
    "siteName": "Aman Radiology",
    "dicomEndpoint": "https://dicom.internal",
    "fhirEndpoint": "https://fhir.internal",
    "inferenceEndpoint": "https://inference.internal",
    "oidcIssuer": "https://issuer.internal",
    "oidcClientId": "aman-clinic",
    "oidcRedirectUri": "https://clinic.example/api/auth/callback/oidc"
  }'
```

## Success Response

```json
{
  "data": {
    "config": {
      "siteName": "Aman Radiology",
      "dicomEndpoint": "https://dicom.internal",
      "fhirEndpoint": "https://fhir.internal",
      "inferenceEndpoint": "https://inference.internal",
      "oidcIssuer": "https://issuer.internal",
      "oidcClientId": "aman-clinic",
      "oidcRedirectUri": "https://clinic.example/api/auth/callback/oidc"
    }
  }
}
```

## Error Responses

```json
{
  "error": "Authentication required",
  "errorKey": "UNAUTHENTICATED"
}
```

```json
{
  "error": "Site configuration is read-only in this deployment mode",
  "errorKey": "SITE_CONFIG_READ_ONLY"
}
```

## What Is Real

- Admin-only access control is enforced.
- Request validation is enforced.
- Local mode persists non-secret config to a JSON file controlled by `SITE_CONFIG_PATH`.
- Cloud mode resolves the same fields from environment variables.

## What Is Mocked / Foundation-Only

- Existing login remains credentials-based.
- No live OIDC discovery, token exchange, or provider registration is wired yet.
- The site-config API prepares endpoint and issuer metadata only.

## Production Follow-Ups

- Add provider-specific OIDC wiring in `src/lib/auth.ts` once issuer and redirect handling are finalized.
- Move admin-managed config from local file storage to a durable managed store if runtime writes are required in cloud.
- Add audit logging for config mutations.
