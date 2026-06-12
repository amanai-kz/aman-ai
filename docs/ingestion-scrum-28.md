# SCRUM-28 Ingestion Foundation

## Endpoints

- `POST /api/ingestion/studies`

## Auth Rules

- Unauthenticated requests return `401`.
- `PATIENT` users return `403`.
- `DOCTOR` and `ADMIN` users are allowed.

## Request Body

```json
{
  "patientId": "patient-1",
  "studyType": "CT_MRI",
  "modality": "MR",
  "studyDate": "2026-06-12T09:00:00.000Z",
  "source": "dicomweb",
  "sourceStudyId": "study-001",
  "series": [
    {
      "seriesInstanceUid": "series-1",
      "instanceCount": 42
    }
  ],
  "files": [
    {
      "fileName": "study1.dcm",
      "sizeBytes": 1024,
      "contentType": "application/dicom"
    }
  ]
}
```

## Curl Example

```bash
curl -X POST http://localhost:3000/api/ingestion/studies \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>" \
  -d '{
    "patientId": "patient-1",
    "studyType": "CT_MRI",
    "modality": "MR",
    "studyDate": "2026-06-12T09:00:00.000Z",
    "source": "dicomweb",
    "sourceStudyId": "study-001",
    "series": [{"seriesInstanceUid": "series-1", "instanceCount": 42}],
    "files": [{"fileName": "study1.dcm", "sizeBytes": 1024}]
  }'
```

## Success Response

```json
{
  "data": {
    "study": {
      "id": "analysis-1",
      "patientId": "patient-1",
      "studyType": "CT_MRI",
      "modality": "MR",
      "studyDate": "2026-06-12T09:00:00.000Z",
      "source": "dicomweb",
      "sourceStudyId": "study-001",
      "status": "PENDING",
      "createdAt": "2026-06-12T09:00:00.000Z"
    },
    "idempotent": false
  }
}
```

## Error Response

```json
{
  "error": "Invalid request body",
  "errorKey": "INVALID_BODY"
}
```

## What Is Real

- A real `Analysis` row is created in Prisma-backed storage.
- Request validation, auth, and role checks are real.
- Duplicate detection is real application logic for the current foundation.

## What Is Mocked / Local-Only

- No PACS server, DIMSE listener, or DICOM parser is started.
- No file bytes are decoded or normalized into DICOM tags.
- `source`, `sourceStudyId`, `modality`, `studyDate`, `series`, and `files` are stored as metadata inside `Analysis.inputData.ingestion`.

## Production Follow-Ups

- Add DB-level uniqueness for source-system study identity instead of app-level scanning.
- Add study/series/instance tables if true DICOM inventory is needed.
- Add background file ingestion, checksuming, and storage integration.
- Add audit logging for ingestion actors and source systems.
