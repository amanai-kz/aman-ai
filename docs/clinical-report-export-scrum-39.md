# SCRUM-39 Clinical Report Export Foundation

## Endpoints

- `POST /api/integrations/ehr/reports`
- `GET /api/integrations/ehr/reports/:id`

## Auth Rules

- Unauthenticated requests return `401`.
- `PATIENT` users return `403`.
- `DOCTOR` and `ADMIN` users are allowed.
- Doctor access still follows assigned-case visibility.

## Signed Report Requirement

- Only signed reports can be exported.
- Unsigned or draft reports return `409` with `errorKey: "REPORT_NOT_SIGNED"`.
- Missing reports return `404` with `errorKey: "CASE_NOT_FOUND"`.

## Request Body

```json
{
  "analysisId": "analysis-1"
}
```

## Curl Examples

```bash
curl -X POST http://localhost:3000/api/integrations/ehr/reports \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>" \
  -d '{"analysisId":"analysis-1"}'
```

```bash
curl http://localhost:3000/api/integrations/ehr/reports/analysis-1 \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>"
```

## Success Response

```json
{
  "data": {
    "export": {
      "id": "analysis-1",
      "analysisId": "analysis-1",
      "status": "sent_mock",
      "destination": {
        "mode": "mock",
        "endpointReference": "http://localhost:8080/fhir"
      },
      "fhir": {
        "resourceType": "DiagnosticReport",
        "id": "analysis-1",
        "status": "final",
        "code": {
          "text": "CT_MRI"
        },
        "subject": {
          "reference": "Patient/patient-1",
          "display": "Assigned Patient"
        },
        "effectiveDateTime": "2026-06-12T09:00:00.000Z",
        "issued": "2026-06-12T10:05:00.000Z",
        "conclusion": "Signed impression"
      },
      "hl7": {
        "messageType": "ORU^R01",
        "version": "2.5.1",
        "message": "MSH|^~\\&|AMANAI|AMAN|RIS|HOSPITAL|20260612100500||ORU^R01|analysis-1|P|2.5.1\rPID|1||patient-1||Assigned Patient\rOBR|1|ACC-001|study-001|CT_MRI|||2026-06-12T09:00:00.000Z\rOBX|1|TX|FINDINGS||Signed findings|\rOBX|2|TX|IMPRESSION||Signed impression|"
      }
    }
  }
}
```

## Error Response

```json
{
  "error": "Signed report required before export",
  "errorKey": "REPORT_NOT_SIGNED"
}
```

## What Is Real

- Auth and role checks are real.
- Export requests resolve a real signed `AnalysisReview`.
- The FHIR DiagnosticReport-like JSON and HL7 ORU-style message are built from real analysis/review fields.
- `fhirEndpoint` from site config is included only as a destination reference.

## What Is Mocked / Local-Only

- No FHIR server request is made.
- No HL7 MLLP socket or integration engine is started.
- The FHIR and HL7 outputs are deterministic local previews.
- Export status is mock delivery state only: `sent_mock`.

## Production Follow-Ups

- Replace preview-only payloads with partner-approved FHIR and HL7 field mappings.
- Add endpoint credentials, retry queueing, and delivery audit trails.
- Add hospital-specific validation, identifiers, and terminology bindings.
- Add transport adapters for FHIR REST and HL7 v2 / MLLP delivery.
