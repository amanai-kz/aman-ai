# SCRUM-29 Inference Foundation

## Endpoints

- `POST /api/inference/jobs`
- `GET /api/inference/jobs/:id`

## Auth Rules

- Unauthenticated requests return `401`.
- `PATIENT` users return `403`.
- `DOCTOR` and `ADMIN` users are allowed.

## Request Body

```json
{
  "analysisId": "analysis-1"
}
```

## Curl Examples

```bash
curl -X POST http://localhost:3000/api/inference/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>" \
  -d '{"analysisId":"analysis-1"}'
```

```bash
curl http://localhost:3000/api/inference/jobs/infer-analysis-1 \
  -H "Cookie: next-auth.session-token=<doctor-or-admin-token>"
```

## Success Response

```json
{
  "data": {
    "job": {
      "id": "infer-analysis-1",
      "analysisId": "analysis-1",
      "status": "COMPLETED",
      "result": {
        "modelName": "aman-mock-radiology",
        "modelVersion": "0.1.0-test",
        "confidence": 0.93,
        "generatedAt": "2026-06-12T10:00:00.000Z",
        "isAiGenerated": true,
        "findings": ["Acute left frontal signal abnormality"],
        "impression": "Priority neuroradiology review is recommended.",
        "priority": "HIGH"
      }
    }
  }
}
```

## Error Response

```json
{
  "error": "Analysis not found",
  "errorKey": "ANALYSIS_NOT_FOUND"
}
```

## What Is Real

- Inference requests validate input and enforce auth/role checks.
- The workflow updates real `Analysis` fields: `status`, `result`, `confidence`, `findings`, `riskLevel`, and `completedAt`.
- `GET /api/inference/jobs/:id` reads back persisted job state from the analysis record.

## What Is Mocked / Local-Only

- No external model server or GPU runtime is called.
- The model output is deterministic and generated in-process from analysis metadata.
- Job identity is synthetic: `infer-<analysisId>`.
- There is no async queue or worker yet; job creation completes immediately.

## Production Follow-Ups

- Add a real job table and worker state machine for queued/running/retry flows.
- Replace deterministic mock output with model adapter interfaces and provider-specific implementations.
- Separate model metadata, inference artifacts, and structured findings from `Analysis.result`.
- Add model-serving auth, timeout handling, and observability around inference execution.
