# SCRUM-25 — Synthetic Augmentation via NV-Generate-MR-Brain

Epic: SCRUM-7. ТЗ §7.1 Stage E, §7.5. Code: `backend/ml_engine/augmentation/`.

## Goal

Synthesise brain MRI for rare pathologies and missing modalities to balance
training, using NVIDIA's NV-Generate-MR-Brain latent-diffusion model.

## Safety Invariant (§7.5)

Every synthetic sample is **tagged and isolated** — it may enter training but
must **NEVER** surface as a patient finding. Enforced at the data-record level:
`SyntheticSample` cannot be constructed without `is_synthetic=True` and the
`synthetic:nv-generate-mr-brain` tag; `assert_no_synthetic_in_patient_view()`
guards any patient-facing pipeline.

## Acceptance Criteria

- NV-Generate-MR-Brain integrated for rare-class + missing-modality synthesis
  (per NVIDIA Open Model Licence — verify commercial terms, §6.2).
- Synthetic samples tagged + isolated; never surfaced as patient findings.
- Ablation shows measurable gain on rare-class metrics.

## What Is Real

- Tagging / isolation guarantees + batch generation API (pure-Python, unit-tested).
- Pluggable `generator_fn` so the pipeline is testable without the model.

## What Is Mocked / Pending

- `load_backend()` (the NVIDIA latent-diffusion model) — `NotImplementedError`
  until the training milestone; requires weights + licence verification.

## Production Follow-Ups

- Wire NV-Generate backend (MONAI/torch); confirm NVIDIA Open Model Licence terms.
- Rare-class ablation through the evaluation harness (SCRUM-26).
