# SCRUM-26 — Evaluation Harness (NLG + Clinical-Efficacy + Triage)

Epic: SCRUM-7. ТЗ §7.3. Code: `backend/ml_engine/evaluation/`.

## Goal

An automated, one-command evaluation harness so every model is gated on
language **and** clinical-correctness metrics before promotion. NLG metrics
alone do not catch factual errors, so clinical-efficacy metrics decide the gate.

## Metrics (all implemented + unit-tested)

- **NLG** (`nlg.py`): BLEU, ROUGE-L, METEOR (lite), CIDEr — pure-Python;
  BERTScore optional (nan if `bert_score` absent).
- **Clinical** (`clinical.py`): CheXbert-style multi-label F1 (micro/macro),
  RadGraph-style entity-F1 + relation-F1, GREEN (optional LLM grader).
- **Triage** (`triage.py`): sensitivity, specificity, precision, AUROC
  (sklearn + NumPy fallback), time-to-flag (mean/p95).
- **Calibration** (`calibration.py`): ECE, MCE, Brier, reliability table.
- **Fairness** (`fairness.py`): per-subgroup breakdown across scanner / field
  strength / site / age / sex; feeds the fairness gap gate.

## Usage

```bash
python -m ml_engine.cli eval --samples tests/data/sample_eval.json \
    --test-set frozen-multisite-v1 --model mr-report-gen:0.1.0
```

Returns the metric set + gate verdict; with `--model` it attaches the report to
a registered model and runs the promotion gates (exit code 2 if the gate fails).
Sample schema: `EvalHarness.SAMPLE_SCHEMA_DOC`.

## Acceptance Criteria

- NLG + clinical (CheXbert-F1, RadGraph F1, GREEN) + triage (sens/spec/AUROC).
- Subgroup/fairness breakdown + calibration.
- One-command eval on the frozen test set; results logged to the registry.

## What Is Real

- All metrics above run end-to-end on a JSON test set (no GPU); 33 unit tests pass.
- Gate integration with the registry (SCRUM-27).

## What Is Mocked / Pending

- BERTScore + GREEN need optional model deps (reported as `nan` / skipped otherwise).
- The frozen multi-site test set itself is built from cleared partner data (§6.3).
