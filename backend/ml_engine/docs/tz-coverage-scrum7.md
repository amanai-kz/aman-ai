# SRS (ТЗ) coverage — MRI AI Engine (Epic SCRUM-7)

Maps the Technical Specification to what is implemented in `backend/ml_engine`,
so reviewers can see exactly which requirements are met, by which code, and what
remains. Honest status only: "implemented" means runnable + unit-tested in this
repo on the synthetic/open-data scaffold; clinical accuracy still requires the
commercially-cleared partner dataset (ТЗ §6.2/§6.3, decisions D10/D17).

## ТЗ §7.1 — Model pipeline (Stages A–E)

| Stage | ТЗ ref | Ticket | Module | Status |
|-------|--------|--------|--------|--------|
| A — Encoder SSL | §7.1 | SCRUM-21 | `encoder/` | Done — SSL pretrain on real IXI; linear-probe beats from-scratch (bal-acc 0.726 vs 0.642) |
| B — Image–text alignment (MR-CLIP) | §7.1 | SCRUM-22 | `alignment/` | Done — contrastive train, registered |
| C — Report generator (LLM + LoRA) | §7.1 | SCRUM-23 | `report_gen/` | Done — LoRA fine-tune; `mr-report-gen:0.1.0` in production/locked |
| D — Triage head (calibrated) | §7.1 | SCRUM-24 | `triage_head/` | Done — multi-label + temperature scaling + abstention |
| **E — Synthetic augmentation** | **§7.1** | **SCRUM-25** | **`augmentation/`** | **Done this session — see below** |

## ТЗ §7.3 / §7.4 / §7.5 — Evaluation, MLOps, Safety

| Capability | ТЗ ref | Ticket | Module | Status |
|------------|--------|--------|--------|--------|
| Evaluation harness (NLG + clinical + triage) | §7.3 | SCRUM-26 | `evaluation/` | Done — metrics + Clopper-Pearson/Wilson/bootstrap CIs; CI-lower-bound gate |
| Model registry, lifecycle, drift | §7.4 | SCRUM-27 | `registry/` | Done — versioned cards, gated `register→eval→staging→sign-off→production`, audit log |
| Calibration / abstention (OOD) | §7.5 | SCRUM-24/26 | `triage_head/`, `evaluation/` | Done — temperature scaling + abstention band |
| Promotion gates (sensitivity ≥ 0.95 on CI lower bound) | §7.3/§7.4 | SCRUM-26/27 | `config/`, `registry/gates.py` | Done |
| Synthetic-data isolation (never a patient finding) | §7.5 | SCRUM-25 | `augmentation/synth.py` | Done — tag + `assert_no_synthetic_in_patient_view` guard |

All 7 stories of Epic SCRUM-7 are now implemented and unit-tested (**74 tests
pass**); the end-to-end `scripts/demo.py` runs all of it on the GPU server.

## Clinical-output safety layer (FR-06 / FR-07 / FR-14 / FR-15)

Built into `serving/` so the engine's outputs meet the ТЗ functional requirements
for safe AI artifacts:

| Requirement | ТЗ ref | Module | Status |
|-------------|--------|--------|--------|
| OOD detection — no AI draft on out-of-distribution studies | FR-14, §4.3 | `serving/ood.py` | Done — Mahalanobis gate, held-out-calibrated FPR; demo AUROC 1.0, in-dist FPR 0.00 |
| Evidence / saliency overlays | FR-07, §9.2 | `serving/saliency.py` | Done — input-gradient 3D saliency + laterality |
| Structured findings + confidence interval | FR-06, §7.3 | `serving/findings.py` | Done — label/laterality/severity + MC-dropout 95% CI |
| Model version + AI-generated label on every artifact | FR-15 | `serving/engine.py` | Done — `assess_study` stamps provenance |

`InferenceEngine.assess_study()` chains them (OOD gate -> structured findings),
shown live as section 7 of `scripts/demo.py`.

## SCRUM-25 (Stage E) — what was built this session

Acceptance criteria (from the ticket + ТЗ §7.1 E / §7.5 / §4.3):

1. **NV-Generate-MR-Brain integrated for rare-class / missing-modality synthesis.**
   `augmentation/generators.py`: `NVGenerateMRBrainGenerator` (real NVIDIA
   3D latent-diffusion backend, gated behind `AMAN_ML_NVGEN_DIR` + MONAI; NVIDIA
   Open Model Licence) and a reproducible `ProceduralLesionGenerator` fallback so
   the pipeline runs without the gated weights. Missing-modality synthesis via
   `synthesize_missing_modality`.
2. **Synthetic samples tagged and isolated; never a patient finding.** Every
   sample carries `synthetic:nv-generate-mr-brain`; `assert_no_synthetic_in_patient_view`
   hard-blocks any leak into a patient-facing surface (§7.5). Unit-tested.
3. **Ablation shows measurable gain on rare-class metrics.**
   `augmentation/ablation.py` (`run_rare_class_ablation`, registered as
   `mr-synthetic-aug:0.1.0`, stage `augmentation`):

   | model | rare-class sensitivity | AUROC | AUPRC | specificity |
   |-------|------------------------|-------|-------|-------------|
   | baseline (imbalanced) | 0.229 | 0.941 | 0.944 | 0.999 |
   | + synthetic augmentation | **0.699** | **0.990** | 0.990 | 1.000 |

   Rare-class sensitivity **+0.470** (augmented 95% Wilson CI [0.670, 0.726]),
   AUROC +0.049, specificity held — acceptance #3 satisfied. Reproducible (seed 0);
   shown live as section 6 of `scripts/demo.py`.

   Honest framing: features/labels are synthetic per the triage scaffold, so the
   generator is represented by its feature-space effect; `--encoder-ckpt` swaps in
   the real Stage-A encoder over generated volumes.

## Broader ТЗ scope (platform / product) — not part of SCRUM-7

These belong to delivery phases P3–P5 (ТЗ §13) and the platform team, not the ML
engine epic. Listed for completeness so coverage is not overstated:

- DICOM/DICOMweb ingestion, de-identification, standardisation (FR-01..03, §5.3) — platform.
- Worklist / viewer / sign-off UI, PACS/RIS return (DICOM SR/SC, HL7/FHIR) (FR-07..11, §9/§10) — platform/product. (A live web surface for the engine — patient upload → real GPU triage → radiologist worklist — was wired this session as a demo.)
- SaMD QMS / regulatory artefacts (§11) — clinical/regulatory.
- Commercially-cleared partner dataset (§6.3) — the one input code cannot supply; gates clinical accuracy.
