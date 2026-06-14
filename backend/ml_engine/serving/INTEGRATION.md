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

## 2. Persist the outputs — reuse the platform's existing review schema

The platform **already has** the radiologist worklist + review/sign-off
architecture (Prisma `Analysis` / `AnalysisReview` / `AnalysisReviewAuditLog`,
`src/app/doctor/worklist`, `ReviewWorkflowStatus`, `ReviewAuditAction`). The
engine maps straight onto it — **don't add a parallel schema**:

| Engine output (JSON) | Existing platform field |
|---|---|
| `report.text` (draft) | `Analysis` result / `AnalysisReview.draftText` |
| `triage.top_finding` + `severity` | `Analysis.riskLevel` (`RiskLevel`) + finding summary |
| `triage.abstain == true` | route to manual review (do **not** auto-resolve) |
| model id e.g. `mr-report-gen:1.0.0-qwen` | store on the analysis/review for traceability |
| radiologist sign-off | existing `AnalysisReview` → `ReviewWorkflowStatus.SIGNED` (D2) |
| each step | existing `AnalysisReviewAuditLog` (`ReviewAuditAction`) |

The mapping (which `Analysis` fields hold the triage flag vs. the narrative, and
whether to add columns) is the product owner's schema decision — the engine just
needs the JSON persisted and the sign-off gate enforced.

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
