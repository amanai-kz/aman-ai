# SCRUM-38 DICOM Result Export Foundation

## Endpoints

- `POST /api/integrations/pacs/results`
- `GET /api/integrations/pacs/results/:id`

## Auth Rules

- Unauthenticated requests return `401`.
- `PATIENT` users return `403`.
- `DOCTOR` and `ADMIN` users are allowed.
- Doctor access still follows assigned-case visibility.

## Signed Report Requirement

- Only signed reports can be exported.
- Unsigned or draft reports return `409` with `errorKey: "REPORT_NOT_SIGNED"`.
- Missing cases return `404` with `errorKey: "CASE_NOT_FOUND"`.

## Request Body

```json
{
  "analysisId": "analysis-1",
  "exportType": "DICOM_SR"
}
```

`exportType` supports:

- `DICOM_SR`
- `SECONDARY_CAPTURE`

## Curl Examples

```bash
curl -X POST http://localhost:3000/api/integrations/pacs/results \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>" \
  -d '{"analysisId":"analysis-1","exportType":"DICOM_SR"}'
```

```bash
curl http://localhost:3000/api/integrations/pacs/results/analysis-1__SECONDARY_CAPTURE \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>"
```

## Success Response

```json
{
  "data": {
    "export": {
      "id": "analysis-1__DICOM_SR",
      "analysisId": "analysis-1",
      "exportType": "DICOM_SR",
      "status": "sent_mock",
      "destination": {
        "mode": "mock",
        "endpointReference": "http://localhost:8042/dicom-web"
      },
      "preparedAt": "2026-06-12T10:05:00.000Z",
      "deliveredAt": "2026-06-15T00:00:00.000Z",
      "payloadPreview": {
        "documentType": "DICOM_SR",
        "patient": {
          "id": "patient-1",
          "name": "Assigned Patient",
          "dateOfBirth": "1988-04-02T00:00:00.000Z",
          "gender": "female"
        },
        "study": {
          "sourceStudyId": "study-001",
          "accessionNumber": "ACC-001",
          "modality": "MR",
          "studyDate": "2026-06-12T09:00:00.000Z",
          "source": "dicomweb",
          "seriesCount": 1
        },
        "report": {
          "findings": "Signed findings",
          "impression": "Signed impression",
          "signedAt": "2026-06-12T10:05:00.000Z",
          "signedBy": {
            "id": "user-doctor-1",
            "name": "Dr. Signed"
          },
          "status": "final"
        }
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
- Export requests resolve a real `Analysis` + `AnalysisReview` pair.
- The signed-report gate is real application logic.
- `dicomEndpoint` from site config is included only as a destination reference.

## What Is Mocked / Local-Only

- No PACS network call is made.
- No DICOM SR writer, SC pixel generation, DICOMweb client, or DIMSE sender is started.
- The payload is a deterministic preview object built from signed report data.
- Export status is mock delivery state only: `sent_mock`.

## Production Follow-Ups

- Replace preview objects with true DICOM SR and Secondary Capture generation.
- Add PACS endpoint authentication, certificates, network configuration, and partner validation.
- Add durable persistence, retry queueing, and export audit history.
- Validate field mappings against the target PACS and radiology workflow.
