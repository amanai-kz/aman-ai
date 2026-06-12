# SCRUM-30 Doctor REST APIs

## Endpoints

- `GET /api/doctor/triage`
- `GET /api/doctor/cases`
- `GET /api/doctor/cases/:id`
- `GET /api/doctor/cases/:id/findings`
- `GET /api/doctor/cases/:id/report`
- `GET /api/doctor/cases/:id/audit`
- `PATCH /api/doctor/cases/:id/review`

All success responses use:

```json
{
  "data": {}
}
```

All error responses use:

```json
{
  "error": "Case not found",
  "errorKey": "CASE_NOT_FOUND"
}
```

## Auth Rules

- Unauthenticated requests return `401`.
- `PATIENT` users return `403` on doctor APIs.
- `DOCTOR` users can only access analyses for assigned patients.
- `ADMIN` users can read and update doctor case APIs without assignment filtering.

## Status Codes

- `200` success
- `400` invalid request body or unsupported input
- `401` unauthenticated
- `403` forbidden or unassigned case access
- `404` missing case
- `409` signed/read-only or sign-off workflow conflicts
- `500` unexpected server error

## Sample Curl

```bash
curl -X GET http://localhost:3000/api/doctor/triage \
  -H "Cookie: next-auth.session-token=<token>"
```

```bash
curl -X PATCH http://localhost:3000/api/doctor/cases/manual-unsigned-critical-mri/review \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{
    "action": "acknowledgeCritical"
  }'
```

## Sample Responses

`GET /api/doctor/triage`

```json
{
  "data": {
    "items": [
      {
        "id": "analysis-1",
        "patientId": "patient-1",
        "patientName": "Assigned Patient",
        "studyType": "CT_MRI",
        "priority": "CRITICAL",
        "status": "PENDING",
        "aiSummary": "Left frontal lesion, Midline shift",
        "updatedAt": "2026-06-12T09:00:00.000Z"
      }
    ],
    "total": 1,
    "counts": {
      "CRITICAL": 1,
      "HIGH": 0,
      "NORMAL": 0
    }
  }
}
```

`GET /api/doctor/cases/:id/report`

```json
{
  "data": {
    "caseId": "analysis-1",
    "findingsDraft": "Existing findings",
    "impressionDraft": "Existing impression",
    "workflowStatus": "EDITED",
    "signedAt": null,
    "signedById": null,
    "criticalAcknowledgedAt": null,
    "criticalAcknowledgedById": null,
    "isReadOnly": false
  }
}
```

## Mocked / Local-Only Notes

- The doctor UI still has local fallback mock pages when the database is unavailable.
- These REST APIs do not expose the UI-only mock cases; they operate on database-backed assigned analyses only.
- Audit data depends on the local review migration and the local review seed/reset flow.
