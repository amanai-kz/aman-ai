# SCRUM-27 — Model Registry, Lifecycle & Drift Monitoring (MLOps)

Epic: SCRUM-7. ТЗ §7.4, §7.5. Code: `backend/ml_engine/registry/`.

## Goal

A model registry, promotion gates, and drift monitoring so releases are
controlled and regressions are caught in production.

## Design

- `ModelCard` (`models.py`) — records **data, code, config, metrics, and
  intended-use scope** per release (§7.4), plus an append-only history.
  Lifecycle: `REGISTERED → EVALUATED → STAGING → PRODUCTION` (+ `ARCHIVED`,
  `REJECTED`), enforced by a transition state machine.
- `RegistryStore` (`storage.py`) — SQLite (stdlib only); model cards + an
  immutable `audit` table (NFR-07).
- `gates.py` — promotion gates vs. a frozen test set: triage **sensitivity ≥ 0.95**
  (safety-critical), AUROC, RadGraph F1, CheXbert F1, ECE max, fairness gap.
- `ModelRegistry` (`registry.py`) — `register` / `attach_eval` (runs gates) /
  `promote` / `sign_off` / `rollback`. **EVALUATED→STAGING requires a passing
  gate; STAGING→PRODUCTION requires reader-study sign-off and locks the model**
  for the regulated path; promotion archives the prior production model.
- `drift.py` — `DriftMonitor` with PSI + KS (NumPy); recommends
  `monitor`/`alert`/`rollback` on input-distribution or proxy-quality drift.

## Usage

```bash
python -m ml_engine.cli register --name mr-report-gen --version 0.1.0 --stage report_gen
python -m ml_engine.cli eval --samples ... --model mr-report-gen:0.1.0   # runs gates
python -m ml_engine.cli promote  --model mr-report-gen:0.1.0             # -> staging
python -m ml_engine.cli sign-off --model mr-report-gen:0.1.0 --reviewer dr.x
python -m ml_engine.cli promote  --model mr-report-gen:0.1.0             # -> production (locked)
python -m ml_engine.cli drift --reference ref.json --current cur.json
python -m ml_engine.cli audit --model mr-report-gen:0.1.0
```

## Acceptance Criteria

- Registry records data/code/config/metrics/intended-use per release.
- Promotion gate requires passing eval + reader-study sign-off; locked-model
  releases for the regulated path.
- Input-distribution + proxy-quality drift monitoring with alerting + rollback.

## What Is Real

- Full registry, lifecycle state machine, gates, audit log, and drift monitor —
  all runnable (SQLite, no GPU) and unit-tested (33 tests pass).

## What Is Mocked / Pending

- Optional MLflow backend (registry currently uses local SQLite).
- Reader-study sign-off is a recorded boolean; the study workflow is external.

## Production Follow-Ups

- Optional MLflow / object-store artifact backend; wire drift monitor to live
  ingestion features + alert channels; connect rollback to model serving.
