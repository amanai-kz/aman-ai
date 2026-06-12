# SCRUM-14 Job Queue Foundation

## Scope

- `src/lib/job-queue.ts`
- inference job orchestration in `src/lib/inference.ts`

## Queue Behavior

- In-process adapter only
- Supported statuses:
  - `queued`
  - `running`
  - `completed`
  - `failed`
- Duplicate enqueue for the same job id reuses the existing in-memory record.

## Current Inference Integration

- `POST /api/inference/jobs` enqueues a synthetic inference job.
- The same request processes the job immediately in-process so existing behavior stays intact.
- `GET /api/inference/jobs/:id` prefers persisted analysis state and can also reflect queued in-memory state when present.

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

## What Is Real

- Queue lifecycle transitions are real application logic.
- Inference requests still update the real `Analysis` row.
- Queue behavior is covered by automated tests.

## What Is Mocked / Local-Only

- No Redis, RabbitMQ, SQS, or background worker is configured.
- Queue state is in-memory and resets with the process.
- Jobs execute immediately in the same process.

## Production Follow-Ups

- Introduce a durable broker and worker process.
- Add retries, dead-letter handling, and timeout policies.
- Split orchestration state into a dedicated job table if jobs must survive restarts.
