# Integrating the MRI engine into the platform

The ML engine is self-contained; the platform owns auth, DB and UI. This is the
contract for wiring them together — no platform code is changed by the engine.

## 1. Mount the inference endpoints

```python
# in the platform FastAPI app
from ml_engine.serving import InferenceEngine, build_router

engine = InferenceEngine.from_checkpoints(
    encoder_ckpt="/ckpts/mr-encoder.pt", triage_ckpt="/ckpts/mr-triage.pt",
    device="cuda",
)
app.include_router(build_router(engine), prefix="/ml", tags=["mri-ai"])
```

Endpoints: `POST /ml/triage`, `POST /ml/report` (NIfTI upload), `GET /ml/models`,
`GET /ml/healthz`. Or run standalone via the bundled `Dockerfile`
(`uvicorn ml_engine.serving.app:create_default_app --factory`).

## 2. Persist the outputs (decision D7 entities)

The engine returns plain JSON; the platform persists it. Suggested Prisma
models for the ML-produced entities (drop into the platform schema):

```prisma
model Report {
  id          String   @id @default(cuid())
  studyId     String
  modelId     String        // e.g. "mr-report-gen:1.0.0-qwen" (registry id)
  text        String        // draft report (radiologist edits/signs)
  status      ReportStatus  @default(DRAFT)
  findings    Finding[]
  triageFlag  TriageFlag?
  reviews     ReviewEvent[]
  createdAt   DateTime @default(now())
}

model Finding {
  id          String  @id @default(cuid())
  reportId    String
  report      Report  @relation(fields: [reportId], references: [id])
  label       String  // e.g. "acute_infarct"
  probability Float
  anatomy     String?
  laterality  String?
}

model TriageFlag {
  id          String   @id @default(cuid())
  reportId    String   @unique
  report      Report   @relation(fields: [reportId], references: [id])
  topFinding  String
  severity    Float
  abstain     Boolean  // true -> route to manual review, never auto-resolve
}

model ReviewEvent {
  id          String   @id @default(cuid())
  reportId    String
  report      Report   @relation(fields: [reportId], references: [id])
  reviewerId  String   // radiologist; required before status -> SIGNED (D2)
  action      String   // "accept" | "edit" | "reject"
  at          DateTime @default(now())
}

enum ReportStatus { DRAFT PENDING_REVIEW SIGNED }
```

## 3. Safety contract (decision D2 — assistive only)

- Every `/triage` and `/report` response carries a `disclaimer`; a `Report`
  must reach `SIGNED` only via a `ReviewEvent` by a radiologist.
- `TriageFlag.abstain == true` means the model declined — surface for manual
  review, never auto-clear.
- Production promotion of any model still goes through the registry gates +
  reader-study sign-off (`ml_engine.cli`).

## 4. Data ingestion (real hospital data)

Hospital DICOM is de-identified + standardised before it reaches the models:

```python
from ml_engine.ingestion import series_to_volume
volume, manifest = series_to_volume("/incoming/study123", img_size=(128,128,128))
# manifest.deidentified == True; set manifest.license_cleared True only for
# data under a signed clearance (decision D10) before using it for *training*.
```
