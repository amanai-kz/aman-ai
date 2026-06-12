# SCRUM-44 Security Hardening

## Implemented Controls

- Added a shared doctor API auth layer with consistent `401` / `403` handling.
- Enforced doctor-to-patient assignment checks on doctor case list, triage, detail, findings, report, audit, and review update APIs.
- Preserved admin access for doctor API reads and review updates.
- Kept signed reports read-only through `409 REPORT_READ_ONLY`.
- Enforced critical acknowledgement before sign-off through `409 CRITICAL_ACK_REQUIRED`.
- Added request-body validation for the review PATCH endpoint.
- Normalized unexpected API failures to `500 INTERNAL_ERROR`.

## Error Keys

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `DOCTOR_PROFILE_REQUIRED`
- `CASE_NOT_FOUND`
- `INVALID_BODY`
- `UNSUPPORTED_REVIEW_ACTION`
- `REPORT_READ_ONLY`
- `CRITICAL_ACK_REQUIRED`
- `INTERNAL_ERROR`

## Sample Curl

```bash
curl -X GET http://localhost:3000/api/doctor/cases/analysis-1 \
  -H "Cookie: next-auth.session-token=<doctor-token>"
```

```bash
curl -X PATCH http://localhost:3000/api/doctor/cases/analysis-1/review \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<doctor-token>" \
  -d '{
    "action": "signOff",
    "findingsDraft": "Final findings",
    "impressionDraft": "Final impression"
  }'
```

## Status Matrix

- `401`: no authenticated session
- `403`: wrong role or unassigned case
- `404`: case id does not exist
- `409`: signed report mutation or critical sign-off conflict
- `500`: unexpected server error

## Sensitive Data / Logging

- Error responses are normalized to `error` and `errorKey`.
- Unexpected backend failures no longer return raw persistence-specific messages to API clients.
- No new endpoint logs patient payloads or request bodies.

## Mocked / Local-Only Notes

- The current API coverage is doctor-review oriented and uses the existing local Prisma review/audit models.
- UI server components still have local mock fallbacks outside these APIs; that mock behavior remains local-only and is not part of the secured doctor REST contract.
