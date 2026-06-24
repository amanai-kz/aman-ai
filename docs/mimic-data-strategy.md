# MIMIC-IV data strategy for Aman AI — how & where to apply it

> **Status:** engineering data-strategy note (not legal advice). Final use of MIMIC
> **must** be cleared with whoever owns data/legal — see §2.
>
> **One-line verdict:** MIMIC is an excellent **R&D / pretraining / evaluation** asset
> for the **labs (S5)**, **biosignals (S2)** and **clinical-NLP** work. It is **not**
> a brain-MRI source and **not** usable in the commercial production model. It does
> **not** unblock decision **D10** (cleared brain-MRI dataset) and must always carry
> `DataProvenance.license_cleared = False`.

---

## 1. What MIMIC actually is

MIMIC-IV (PhysioNet, Beth Israel Deaconess Medical Center, ICU + ED) is a large,
de-identified **EHR** database. It is **tabular + text + waveforms**, *not* imaging
of the brain. Relevant components:

| Component | Contents | Aman relevance |
|---|---|---|
| **MIMIC-IV `hosp`** | `labevents`, `d_labitems`, `microbiologyevents`, `diagnoses_icd`, `prescriptions`, `omr`, `patients`, `admissions` | 🟢 labs (S5), cohorting |
| **MIMIC-IV `icu`** | `chartevents` (vitals), `inputevents`, `d_items` | 🟡 vitals (S2-adjacent) |
| **MIMIC-IV-ED** | `triage`, `vitalsign`, `edstays` | 🟡 vitals, triage |
| **MIMIC-IV-Note** | `discharge` + `radiology` free-text | 🟢 clinical NLP / report-gen |
| **MIMIC-IV-ECG** | 12-lead ECG waveforms | 🟢 S2 biosignals |
| **MIMIC waveform DBs (III/IV)** | continuous PPG, ABP, ECG, resp | 🟢 S2 (HRV, PPG) |
| **MIMIC-CXR** | chest X-ray + reports | 🔴 **chest, not brain** — irrelevant to S1 |

**No brain MRI/CT. No genomics. No psychometric instruments.** For S1 brain imaging
you still need ADNI / OASIS / IXI(full) / BraTS (all research-licensed too — same
commercial caveat as §2).

---

## 2. Licensing & compliance — read this first

This is the gating constraint, not the engineering.

- **Standard MIMIC = PhysioNet *Credentialed* Health Data License.** It is for
  **research**. Each user needs: a PhysioNet account → CITI *"Data or Specimens Only
  Research"* training → a signed **DUA**. Data **may not** be redistributed, committed
  to this repo, or re-identified; storage/cloud is constrained (BAA rules).
- **Commercial use is not granted** by that license. Training models that ship in the
  **commercial product (amanai.kz)** is therefore **out of scope** without a separate
  agreement. This is the *same posture* the codebase already encodes for
  `IXITiny`/`MR-RATE` ("research-only") and the `license_cleared` flag.
- **Mapping to our decisions/flags:**
  - `backend/ml_engine/ingestion` `DataProvenance.license_cleared` → **stays `False`** for any
    MIMIC-derived model. Such models are R&D artifacts, never promoted to `PRODUCTION`.
  - **D10** (commercially-cleared dataset) → **NOT** satisfied by MIMIC.
  - **D11** (KZ data residency) → MIMIC is US-sourced under a US DUA; keep it on a
    controlled research box, **never** mix with KZ production patient data.
- **Zero-friction starting point:** the **MIMIC-IV Clinical Database Demo** (~100
  patients) is published under the **Open Data Commons ODbL** — *not* credentialed,
  freely downloadable. Use it to build and test everything below before anyone touches
  the full credentialed set.
- **Convenience:** the full set is queryable on **Google BigQuery** via PhysioNet
  (no local 100 GB load needed for exploration).

**Action before any real investment:** legal/owner sign-off on intended use
(R&D vs anything touching product).

---

## 3. Where it applies — per module

### 🟢 S5 — Blood / labs (strongest fit)
Code today: `backend/app/services/blood_nlp_extractor.py`,
`backend/app/services/invivo_blood_parser.py` (parse lab PDFs), plus the `Blood`
analysis flow.

MIMIC `labevents` + `d_labitems` give millions of real, reference-flagged lab results
with **LOINC** codes. Use it to:
1. **Validate & calibrate reference ranges / abnormality logic** against real
   distributions instead of hard-coded cut-offs.
2. **Train a lab-panel abnormality / risk model** (input: a panel of analytes →
   output: flags / risk) that the S5 service can call.
3. **Standardize analytes to LOINC** (MIMIC `d_labitems.loinc_code`) → directly feeds
   the FHIR export (`src/lib/clinical-report-export.ts`).
4. **Neuro cohort signal:** filter `diagnoses_icd` for neurodegenerative codes
   (Alzheimer's ICD-10 `G30` / ICD-9 `331.0`, Parkinson's `G20`, vascular dementia) and
   study the lab/biomarker patterns of that cohort — the closest MIMIC gets to your
   neuro mission.

⚠️ **Unit harmonization:** MIMIC uses US conventions (e.g. mg/dL); invivo/KZ labs use
SI (mmol/L). Build a unit-mapping layer or models won't transfer.

### 🟢 S2 — Physiological signals
Code today: PPG/IMU/EMG + HRV (S2). MIMIC waveform DBs (PPG, ECG, ABP, resp) and
`MIMIC-IV-ECG` provide real continuous signals for **HRV feature extraction**,
**signal-quality models**, and **pretraining** biosignal encoders before fine-tuning on
your wearable data. ICU `chartevents` adds vitals time-series.

### 🟢 Clinical NLP / report generation
Code today: `backend/ml_engine/alignment` (SCRUM-22, MR-RATE — image–text alignment /
MR-CLIP, **not** general text NLP), `backend/ml_engine/report_gen/generator.py`
(report generation), the consultation/encounter NLP. `MIMIC-IV-Note` (discharge
summaries + radiology reports) is a large real-text corpus to **evaluate**
report-gen/extraction and to build comorbidity/entity extractors. ⚠️ Radiology notes
are chest/abdo/etc., **not brain** — good for NLP method validation, not brain-specific
content.

### 🟢 EHR / FHIR pipeline hardening
Use MIMIC's realistic EHR shape to exercise the ingestion + export paths
(`src/lib/clinical-export-shared.ts`, `dicom-result-export.ts`,
`clinical-report-export.ts`) — round-trip real labs/notes → FHIR/HL7.

### 🔴 Does NOT apply
- **S1 neuroimaging** — no brain MRI/CT (CXR is chest).
- **S4 genetics** — no genomic data.
- **S3 psychometrics** — no questionnaire instruments.
- **S6 neurorehab (CV/motion)** — no relevant data.

---

## 4. How — technical integration

Keep MIMIC strictly as an **offline train/eval feed**. Never wire it into a request
path or the cleared `--data-dir` production path.

1. **New ingestion adapter** alongside the DICOM one:
   `backend/ml_engine/ingestion/ehr.py` (or `tabular.py`). It loads MIMIC
   labs/notes/waveforms and emits the **same** `IngestionManifest` / `DataProvenance`
   shape as `dicom.py`, hard-coded `license_cleared=False`, `deidentified=True`.
2. **Source switch:** read from the **demo CSVs** first; later, optionally the BigQuery
   client for the full set. Same adapter interface either way.
3. **Schema mapping layer:** MIMIC tables → internal feature frames (labs panel,
   signal windows, note records), with the LOINC + unit-harmonization map from §3.
4. **Consumption:**
   - S5: a new training/eval entry under the ML engine that trains the lab model on the
     mapped frames; register the checkpoint with `license_cleared=False`.
   - S2: pretraining notebook/script for the biosignal encoder.
   - NLP: an eval harness that scores report-gen/extraction on MIMIC-Note.
5. **Storage:** controlled research machine / bucket only. `.gitignore` the data dir;
   never commit a single row.

---

## 5. Phased rollout

| Phase | Scope | Output | Gate |
|---|---|---|---|
| **0 — Legal & demo** | Owner/legal sign-off on R&D use; download the **ODbL demo** | go/no-go + demo data on a controlled box | legal ✅ |
| **1 — Ingestion adapter** | `backend/ml_engine/ingestion/ehr.py` against demo; manifest + provenance | labs/notes load into internal frames; tests | unit tests green |
| **2 — S5 lab model** | Reference-range calibration + abnormality model on labs | model (license_cleared=False) + eval report | held-out metrics |
| **3 — S2 / NLP** | Biosignal pretraining + MIMIC-Note NLP eval | pretrained encoder, NLP benchmark | metrics vs baseline |
| **4 — Full set (optional)** | Credentialing (CITI+DUA) + BigQuery for scale | scaled training/eval | DUA signed |

> **Credentialing scope (read with the table):** phases 1–3 run **entirely on the
> ODbL demo** (~100 patients, no DUA, freely downloadable), so they need only the
> Phase-0 legal sign-off — **not** a DUA. A signed **CITI + DUA** is required *only*
> for the full credentialed set in phase 4. Phase 0's "legal ✅" authorises R&D
> intent; it does **not** substitute for the DUA before any credentialed-data access.

---

## 6. Guardrails (do NOT)

- ❌ Commit any MIMIC data to the repo.
- ❌ Serve MIMIC-derived data through any product/API route.
- ❌ Promote a MIMIC-trained model to `PRODUCTION` / set `license_cleared=True`.
- ❌ Use it for the commercial model or count it toward D10.
- ❌ Mix it with KZ production patient data (D11).
- ❌ Attempt re-identification or share credentialed access.

---

## 7. Open questions

- Legal: is **any** MIMIC use acceptable for a company building a commercial product,
  even R&D-only? (Confirm with counsel — some orgs avoid it entirely to keep models
  commercially "clean".)
- Does an R&D-pretrained-on-MIMIC encoder, fine-tuned later on cleared data, taint the
  production model's license posture? (Likely yes for the weights — assume so until
  cleared.)
- Unit/locale gap (US vs KZ labs) — how much does it limit transfer for S5?

---

## 8. References

- MIMIC-IV: https://physionet.org/content/mimiciv/
- MIMIC-IV-Note: https://physionet.org/content/mimic-iv-note/
- MIMIC-IV-ECG: https://physionet.org/content/mimic-iv-ecg/
- MIMIC-IV demo (ODbL, open): https://physionet.org/content/mimic-iv-demo/
- MIMIC on BigQuery: https://mimic.mit.edu/docs/gettingstarted/cloud/
- Related: `docs/regulatory-readiness.md`, `docs/ingestion-scrum-28.md`, `backend/ml_engine/ingestion/`
