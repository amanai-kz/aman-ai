# SCRUM-68 — S2 Biosignal Encoder: SSL Pretraining on MIMIC Vitals + ECG

Epic: SCRUM-63 (MIMIC integration), Phase 3 of `docs/mimic-data-strategy.md`.
Depends on the SCRUM-64 Phase-0 gate (merged, PR #43). Code:
`backend/ml_engine/ingestion/ehr.py`, `backend/ml_engine/ingestion/ecg.py`,
`backend/ml_engine/biosignal/`.

## Goal

A pretraining scaffold for the S2 service's (team Mukhammedzhan) eventual
wearable-PPG/ECG encoder, using MIMIC-IV as an R&D/pretraining feed per the
data strategy — never a production-eligible model (D10/D11).

## Data reality check (read first — corrected from the first pass)

Two MIMIC tiers are now downloaded, at different fidelity:

- **MIMIC-IV Clinical Database Demo** (v2.2, ODbL, no DUA — SCRUM-64). Its
  `icu/chartevents` gives only **intermittently charted vitals** (heart rate,
  respiratory rate, SpO2, NIBP), sampled roughly hourly by nursing staff —
  no continuous waveform.
- **MIMIC-IV-ECG Demo** (v0.1, **also ODbL, also no DUA** — verified directly
  against the PhysioNet project page, not assumed). This *does* carry genuine
  continuous waveform: 659 twelve-lead, 500 Hz, 10-second diagnostic ECGs
  across 92 patients overlapping the Clinical Database Demo cohort. **This
  corrects the initial version of this doc**, which stated no open-access
  continuous waveform existed — it does, as a small matched-subset demo of
  the forthcoming full (credentialed) `MIMIC-IV-ECG` module. Downloaded and
  checksum-verified (1321/1321 files OK); provenance note at
  `~/aman-data/mimic-iv-ecg-demo/DATA_PROVENANCE.md`.
- **Still not available:** `MIMIC-IV-Note` (discharge/radiology text) has
  **no open demo tier** — confirmed directly against its PhysioNet page
  (`PhysioNet Credentialed Health Data License 1.5.0`, CITI + signed DUA
  required, no exception). The "MIMIC-Note NLP eval" half of the Phase-3
  roadmap item remains **blocked on a credentialing/legal decision**, not
  implemented here — building a fake eval against non-existent text would
  violate this project's "demo framing is honest" convention.

Net: this milestone now covers two honestly-scoped tiers — coarse
**vitals-time-series pretraining** (real signal, not real HRV) *and*
genuine **ECG-waveform pretraining with real R-peak-derived HRV** (real
signal, but still demo-scale: 92 patients, single 10 s strip each, not a
clinical HRV study).

## Design

- `ingestion/ehr.py` — MIMIC `icu/chartevents` → per-ICU-stay hourly vitals
  windows (5 channels). Emits `EhrIngestionManifest`.
- `ingestion/ecg.py` — MIMIC-IV-ECG demo WFDB records → `(leads, samples)`
  waveforms. Runs a lightweight Pan-Tompkins-style R-peak detector (bandpass
  + derivative + moving-window integration + peak-picking, `scipy`) per
  record and attaches real SDNN/RMSSD/mean-HR to `EcgIngestionManifest` —
  informational provenance, not an SSL target. Not clinical-grade (single
  short strip, simple detector).
- Both manifests are field-for-field analogues of `ingestion/dicom.py`'s
  `IngestionManifest` (`deidentified=True`, `license_cleared=False` always).
- `biosignal/model.py` — `BiosignalEncoder1D`: a small 1D-patch ViT
  (`Conv1d` patch embed → cls token + positional embeddings →
  `TransformerEncoder`), generic over channel count / sequence length so the
  same architecture serves both data tiers. `MaskedBiosignalSSL` reapplies
  the MRI encoder's SimMIM recipe (decision D15: mask at the input, not
  after the forward pass).
- `biosignal/train.py` — training loop mirroring `encoder/train.py`:
  `SyntheticVitalsWindows` (no-download placeholder), `EhrVitalsDataset`
  (`--mimic-dir`), or `EcgWaveformDataset` (`--ecg-dir`); registers
  checkpoints under `stage="biosignal_encoder"`.

## Real runs (CPU)

**Vitals** (`s2-biosignal-encoder:0.1.0`):

```bash
python -m ml_engine.biosignal.train --mimic-dir ~/aman-data/mimic-iv-demo/2.2 \
    --steps 50 --batch-size 8 --warmup 5 --device cpu --register
```

116 ICU stays met the coverage threshold (24-hour windows, 5 channels).
Loss decreased monotonically over 50 steps (`1.057 → 0.631`).

**ECG** (`s2-ecg-encoder:0.1.1`):

```bash
python -m ml_engine.biosignal.train \
    --ecg-dir ~/aman-data/mimic-iv-ecg-demo/mimic-iv-ecg-demo-diagnostic-electrocardiogram-matched-subset-demo-0.1 \
    --in-channels 12 --seq-len 5000 --patch-size 50 --embed-dim 64 --depth 2 --heads 4 \
    --steps 300 --batch-size 16 --warmup 20 --lr 3e-4 --device cpu --register
```

All 659 records loaded (12 leads × 5000 samples each) in ~3 s. Loss trends
down but noisily over 300 steps (`1.045 → ~0.94`) — real learning, but
markedly slower/noisier than the vitals run. That's expected, not a bug:
raw 500 Hz ECG concentrates most of its energy in narrow, sharp QRS
complexes, so masked-*amplitude* reconstruction is a harder objective on a
small (659-window) dataset than smoothly-varying hourly vitals. Real R-peak
detection on a representative record found **HR ≈ 91 bpm, SDNN ≈ 9.8 ms,
RMSSD ≈ 9.4 ms** — plausible for a MIMIC ICU/ED cohort (tachycardic, low
short-term variability), not cherry-picked (cohort-wide: mean HR ≈ 92 bpm,
mean SDNN ≈ 71 ms, driven up by a few likely-arrhythmic/detector-noisy
outliers — consistent with "simple detector, ICU population," not a
validated clinical HRV claim).

## What Is Real

- Both ingestion adapters, run against actual downloaded MIMIC data (not
  mocks) — 116 real ICU stays (vitals) and all 659 real ECG records.
- Real R-peak detection and HRV computation on genuine waveform data — a
  real (if simple, non-clinical-grade) signal-processing pipeline, not a
  stub returning fixed numbers.
- Full encoder + SimMIM-style SSL objective (PyTorch), same recipe already
  validated for the MRI encoder (D15), reused unmodified across both data
  tiers via config alone (`in_channels`/`seq_len`).
- Registry integration for both: correct `stage`, `DataProvenance`
  (`license_cleared=False`, dataset name recorded), never touches promotion
  gates (R&D artifacts only).
- Two real training runs on real data with decreasing loss (not
  synthetic-only): vitals converges cleanly, ECG converges slowly/noisily —
  reported as such, not smoothed over.

## What Is Mocked / Pending

- `SyntheticVitalsWindows` is a CPU-only, no-download fallback for the
  training loop (parallels `SyntheticMRIVolumes`), not a substitute for
  either real run above.
- No downstream probe yet (no labelled task to linear-probe against, unlike
  the MRI encoder's IXI-based check) for either data tier.
- **MIMIC-Note NLP eval is not implemented** — confirmed blocked (see Data
  reality check), not attempted with fake data.
- ECG pretraining converges slowly on this demo's 659 windows; the full
  credentialed `MIMIC-IV-ECG` corpus (thousands of records) or a smarter SSL
  target (e.g. reconstructing a filtered/derivative signal, or a contrastive
  objective — common in real ECG-SSL literature) would likely help more than
  further hyperparameter tuning on this small sample.

## Production Follow-Ups

- Legal/owner decision on acquiring the full credentialed `MIMIC-IV-ECG` /
  MIMIC Waveform DB (much larger N, multi-minute recordings — real HRV, not
  single-strip) or a `MIMIC-IV-Note`-equivalent source for the NLP-eval half.
- A held-out downstream task to linear-probe both pretrained encoders
  against, mirroring `encoder/linear_probe.py`'s beats-from-scratch check
  (e.g. an ICU-mortality/early-warning label for vitals; an ECG-diagnosis
  label if the full MIMIC-IV-ECG's paired diagnostic statements are acquired).
- Consider a contrastive or filtered-target SSL objective for the ECG
  encoder specifically, given the raw-amplitude masked-reconstruction result
  above.
- Swap in the real wearable PPG/ECG pipeline once S2 hardware data exists;
  the ingestion/training contracts (`IngestionManifest`-shaped manifest,
  `--mimic-dir`/`--ecg-dir`-style swap) are designed to carry over.
