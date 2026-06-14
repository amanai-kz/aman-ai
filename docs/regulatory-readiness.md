# Regulatory & data-clearance readiness — brain-MRI assistant

Status of the items that gate a production / clinical deployment but are **not
software** — they need business, legal, and clinical action. For each, what the
engine already provides vs. what the customer must execute.

> This document is an engineering-side readiness map, **not** a regulatory
> approval and **not** legal advice. Final wording must be confirmed with
> regulatory counsel.

## Intended use (draft — finalise with counsel)

> The system is an **assistive** tool that produces draft brain-MRI reports and
> triage flags (T1/T2/FLAIR/SWI) for review by a qualified radiologist. It does
> **not** make autonomous diagnoses. Every report is provisional until a
> radiologist reviews, edits as needed, and signs off. Out-of-distribution or
> low-confidence studies are abstained and routed to manual review.

(Matches decisions D2/D3; this is the regulatory intended-use anchor.)

## Gating items (external) → engineering support already in place

| Requirement (external action) | Owner | Engine support already built |
|---|---|---|
| **Commercially-cleared dataset** (signed DPA / partner data agreement; IXITiny/MR-RATE are research-only) | Business + legal | DICOM ingestion + PHI de-identification (`ml_engine/ingestion`); `DataProvenance.license_cleared` on every model; train loops take `--data-dir` — cleared data is drop-in |
| **KZ SaMD classification** | Regulatory counsel | Assistive intended-use posture (D2); model lifecycle + locking for the regulated path (`ml_engine/registry`) |
| **Clinical validation / reader study** | Clinical + regulatory | Reader-study sign-off gate + model locking before `PRODUCTION`; eval harness (sensitivity/AUROC/ECE/fairness) on a frozen test set |
| **Data residency (KZ, on-prem/in-country)** (D11) | Infra + legal | Self-hosted serving (`ml_engine/serving`, Dockerfile); no external calls at inference |
| **Post-market monitoring** | Clinical ops | PSI/KS drift monitor with rollback (`ml_engine/registry/drift.py`) |
| **Promotion governance** | ML + clinical | Promotion gates (triage sens ≥0.95, etc.) + immutable audit log |

## Action checklist (customer)

1. Sign a hospital/partner **Data Processing Agreement**; obtain the cleared
   dataset. Ingest via `ml_engine.ingestion`; set `license_cleared=True`; run
   full training (`--data-dir`).
2. Engage **regulatory counsel** for KZ SaMD classification + the intended-use
   statement above.
3. Run a **clinical reader study** on the frozen test set; record sign-off
   through the registry before any `PRODUCTION` promotion.
4. Provision **in-country** infra; deploy the serving container; wire the
   product endpoints (PRs #24/#25).
5. Stand up **drift monitoring** on live data using `registry/drift.py`.

Until steps 1–3 are complete, the system is a **validated engineering build on
research-licensed data** — capable and integrated, but not a certified medical
device. That distinction is intentional and must not be elided.
