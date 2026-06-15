# SCRUM-31 OOD Detection and Manual-Review Routing

## What OOD Means

OOD means out-of-distribution input: a study whose modality, sequence, anatomy, scanner, metadata quality, or confidence profile falls outside the safe assumptions of the current deterministic local inference foundation.

For these cases, the system abstains instead of generating a normal AI draft.

## Detection Rules

The deterministic OOD gate currently checks:

- missing required ingestion metadata: `modality`, `studyDate`, `sourceStudyId`
- unsupported modality for `CT_MRI`
- unsupported CT/MRI sequence names or protocol labels
- anatomy or body-part labels outside the current neuroradiology-safe allowlist
- unknown scanner/manufacturer values outside the current allowlist
- low confidence when an existing score is present

Example reason codes:

- `UNSUPPORTED_MODALITY`
- `UNSUPPORTED_STUDY_TYPE`
- `MISSING_STUDY_METADATA`
- `UNSUPPORTED_SEQUENCE`
- `LOW_MODEL_CONFIDENCE`
- `UNKNOWN_SCANNER`
- `OUTSIDE_TRAINING_DISTRIBUTION`

## API Behavior

No new endpoint was added.

Updated behavior:

- `POST /api/inference/jobs`
- `GET /api/inference/jobs/:id`
- `GET /api/doctor/cases/:id`
- `GET /api/doctor/cases/:id/findings`
- `GET /api/doctor/cases`
- `GET /api/doctor/triage`

## Inference Manual-Review Routing

If the OOD gate flags a study:

- inference completes with an abstention result
- no normal AI findings are generated
- no normal AI impression is generated
- `Analysis.result.oodDetection` stores deterministic abstention metadata
- `Analysis.result.inferenceJob.result` stores a mock abstention payload
- `Analysis.findings` is persisted as an empty array
- `Analysis.riskLevel` is routed to `HIGH` for manual-review visibility

## Doctor Workflow Behavior

For abstained cases:

- doctor findings APIs expose `manualReviewRequired`, `abstain`, and `ood` metadata
- default report drafts are empty when no clinician draft exists yet
- the AI presentation shows abstention/manual-review context instead of fabricated findings
- existing review, edit, sign-off, and export flows remain unchanged

## Sample Input

```json
{
  "analysisId": "analysis-1"
}
```

Stored ingestion metadata that would trigger OOD:

```json
{
  "ingestion": {
    "source": "dicomweb",
    "sourceStudyId": "study-ood-001",
    "modality": "XR",
    "studyDate": "2026-06-12T09:00:00.000Z"
  }
}
```

## Sample Output

```json
{
  "data": {
    "job": {
      "id": "infer-analysis-1",
      "analysisId": "analysis-1",
      "status": "COMPLETED",
      "result": {
        "modelName": "aman-ood-gate",
        "modelVersion": "0.1.0-test",
        "confidence": 0.12,
        "generatedAt": "2026-06-12T10:00:00.000Z",
        "isAiGenerated": false,
        "findings": [],
        "impression": "",
        "priority": "HIGH",
        "manualReviewRequired": true,
        "abstain": true,
        "summary": "Manual review required",
        "ood": {
          "isOod": true,
          "manualReviewRequired": true,
          "abstain": true,
          "reasons": ["UNSUPPORTED_MODALITY"],
          "severity": "high",
          "confidence": 0.98,
          "checkedAt": "2026-06-12T10:00:00.000Z"
        }
      }
    }
  }
}
```

## What Is Real

- auth and role enforcement are real
- OOD evaluation is real application logic
- abstention metadata is persisted into the real `Analysis.result` field
- doctor APIs now expose abstention/manual-review state from persisted data
- report auto-draft suppression for abstained cases is real

## What Is Mock / Foundation-Only

- no statistical OOD model is used
- no external model server or monitoring sink is called
- no external audit/event pipeline is written to
- the OOD rules are deterministic local heuristics and safe allowlists

## Production Follow-Ups

- replace heuristics with calibrated OOD scoring or ensemble abstention logic
- maintain scanner, anatomy, and sequence allowlists with the clinical team
- add dedicated monitoring dashboards and alerting for abstention rates
- emit abstention events to an external audit/event sink
- separate clinical priority from model-safety/manual-review priority
