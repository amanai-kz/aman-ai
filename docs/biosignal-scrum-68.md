# SCRUM-68 — S2 Biosignal Encoder: SSL Pretraining on MIMIC ICU Vitals

Epic: SCRUM-63 (MIMIC integration), Phase 3 of `docs/mimic-data-strategy.md`.
Depends on the SCRUM-64 Phase-0 gate (merged, PR #43). Code:
`backend/ml_engine/ingestion/ehr.py`, `backend/ml_engine/biosignal/`.

## Goal

A pretraining scaffold for the S2 service's (team Mukhammedzhan) eventual
wearable-PPG/ECG encoder, using MIMIC-IV as an R&D/pretraining feed per the
data strategy — never a production-eligible model (D10/D11).

## Data reality check (read first)

The only MIMIC tier downloaded so far is the **Clinical Database Demo**
(v2.2, ODbL, no DUA — the SCRUM-64 provenance note). It contains:

- `icu/chartevents` — **intermittently charted vitals** (heart rate,
  respiratory rate, SpO2, non-invasive blood pressure), sampled roughly
  hourly by nursing staff.
- **No continuous PPG/ECG waveforms.** No `MIMIC-IV-ECG`, no MIMIC Waveform
  Database. Both are separate, fully-*credentialed* PhysioNet projects
  (CITI + signed DUA — Phase 4 in the data strategy), not yet acquired.
- **No `MIMIC-IV-Note`** either (discharge/radiology text) — also a separate
  credentialed project with no open demo tier found. The "MIMIC-Note NLP
  eval" half of the Phase-3 scope in the roadmap is **blocked on that
  acquisition decision**, not implemented here; see Follow-Ups.

So this milestone is honestly scoped as **vitals-time-series pretraining**,
not HRV in the strict beat-to-beat sense. That's a real, legitimate S2-adjacent
signal (data-strategy.md §3 calls out ICU `chartevents` explicitly), just not
what "PPG/ECG/HRV" implies at face value.

## Design

- `ingestion/ehr.py` — MIMIC `icu/chartevents` → per-ICU-stay windows.
  Pivots 5 channels (`heart_rate`, `resp_rate`, `spo2`, `nibp_systolic`,
  `nibp_diastolic`) onto an hourly grid, drops stays below a coverage
  threshold, gap-fills by interpolation, and emits `EhrIngestionManifest` —
  the same shape as `ingestion/dicom.py`'s `IngestionManifest`
  (`deidentified=True`, `license_cleared=False` always).
- `biosignal/model.py` — `BiosignalEncoder1D`: a small 1D-patch ViT
  (`Conv1d` patch embed → cls token + positional embeddings →
  `TransformerEncoder`). `MaskedBiosignalSSL` reapplies the MRI encoder's
  SimMIM recipe (decision D15: mask at the input, not after the forward
  pass) to vitals windows.
- `biosignal/train.py` — training loop mirroring `encoder/train.py`:
  `SyntheticVitalsWindows` (no-download placeholder) or `EhrVitalsDataset`
  (real MIMIC demo data via `--mimic-dir`); registers checkpoints in the
  model registry under `stage="biosignal_encoder"`.

## Real run (MIMIC-IV demo, CPU)

```bash
python -m ml_engine.biosignal.train \
    --mimic-dir ~/aman-data/mimic-iv-demo/2.2 \
    --steps 50 --batch-size 8 --warmup 5 --device cpu --register
```

116 ICU stays met the coverage threshold (24-hour windows, 5 channels).
Loss decreased monotonically over 50 steps (`1.057 → 0.631`), confirming the
masked-reconstruction objective is a real learning signal on real MIMIC data,
not just shape-checked. Registered as `s2-biosignal-encoder:0.1.0`,
`data.license_cleared=False`.

## What Is Real

- Full ingestion adapter, run against the actual downloaded MIMIC-IV demo
  (not a mock) — 116 real ICU stays produce real windows.
- Full encoder + SimMIM-style SSL objective (PyTorch), same recipe already
  validated for the MRI encoder (D15).
- Registry integration: registers with the correct `stage`, `DataProvenance`
  (`license_cleared=False`, dataset name recorded), never touches promotion
  gates (R&D artifact only).
- A real training run on real data, loss decreasing (not synthetic-only).

## What Is Mocked / Pending

- `SyntheticVitalsWindows` is a CPU-only, no-download fallback for the
  training loop (parallels `SyntheticMRIVolumes`), not a substitute for the
  real MIMIC run above.
- No downstream probe yet (no labelled task to linear-probe against, unlike
  the MRI encoder's IXI-based check) — there's no obvious label in the demo
  tier to validate transfer against.
- **MIMIC-Note NLP eval is not implemented.** No note-like free text exists
  in the downloaded demo; building a fake eval against non-existent data
  would violate this project's "demo framing is honest" convention.

## Production Follow-Ups

- Legal/owner decision on acquiring `MIMIC-IV-ECG` / the MIMIC Waveform DB
  (credentialed) if true continuous-waveform HRV pretraining is wanted, or
  on a `MIMIC-IV-Note`-equivalent source for the NLP-eval half.
- A held-out downstream task (e.g. a chartevents-derived early-warning label)
  to linear-probe the pretrained encoder against, mirroring
  `encoder/linear_probe.py`'s beats-from-scratch check.
- Swap in the real wearable PPG/ECG pipeline once S2 hardware data exists;
  the ingestion/training contracts (`IngestionManifest`-shaped manifest,
  `--mimic-dir`-style swap) are designed to carry over.
