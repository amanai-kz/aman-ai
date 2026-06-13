# SCRUM-24 — Triage Classifier for Critical Findings (Calibrated)

Epic: SCRUM-7. ТЗ §7.1 Stage D, §7.3, §7.5, FR-05. Code: `backend/ml_engine/triage_head/`.

## Goal

Flag and prioritise time-critical findings (intracranial haemorrhage, mass
effect, acute infarct) so urgent cases are read first (UC-2). Supplements,
never replaces, radiologist review.

## Design

- `TriageHead` — multi-label MLP head on the encoder's pooled features.
- `TemperatureScaler` — post-hoc single-parameter calibration (Guo et al. 2017),
  fit on a held-out split via LBFGS.
- `predict()` — calibrated per-finding probabilities, proxy severity, and an
  **abstain** flag when max confidence ∈ (0.30, 0.70) → route to manual review.

## Acceptance Criteria

- Calibrated head for defined critical findings.
- **Sensitivity ≥ 0.95** on the frozen test set; AUROC + time-to-flag reported.
- Confidence/abstention surfaced; supplements (never replaces) review.

## What Is Real

- Head + temperature scaling (PyTorch) and the full triage metric suite
  (sensitivity/specificity/AUROC/time-to-flag) + the sensitivity ≥ 0.95 gate,
  already implemented and unit-tested in `ml_engine.evaluation` / `registry`.

## What Is Mocked / Pending

- Trained weights — needs labelled critical-finding data + the encoder (SCRUM-21).

## Production Follow-Ups

- Train + calibrate on cleared labelled data; verify the sensitivity gate.
- Wire abstention into the worklist (OOD → manual, FR-14) and time-to-flag SLA (NFR-01).
