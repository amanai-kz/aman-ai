# MRI AI Engine (Epic SCRUM-7)

Core IP for the Aman AI MRI Radiology Assistant: a 3D MRI vision encoder,
image–text alignment, an LLM report generator, a calibrated triage classifier,
synthetic augmentation, an evaluation harness, and model lifecycle / MLOps.

Reference: SRS/ТЗ §7. Tracks Jira epic **SCRUM-7** (stories SCRUM-21..27).

## Layout

| Package        | Ticket   | Status            | Needs |
|----------------|----------|-------------------|-------|
| `registry/`    | SCRUM-27 | ✅ implemented    | stdlib + numpy |
| `evaluation/`  | SCRUM-26 | ✅ implemented    | numpy, scikit-learn |
| `encoder/`     | SCRUM-21 | 🏗 architecture   | torch |
| `alignment/`   | SCRUM-22 | 🏗 architecture   | torch |
| `report_gen/`  | SCRUM-23 | 🏗 architecture   | torch, transformers, peft |
| `triage_head/` | SCRUM-24 | 🏗 head + calib   | torch |
| `augmentation/`| SCRUM-25 | ✅ tagging / API  | (model: torch+monai) |
| `config/`      | —        | settings + gates  | stdlib |
| `cli/`         | —        | MLOps CLI         | — |

✅ = runnable + unit-tested now (no GPU). 🏗 = real architecture; training wired
when FOMO300K / cleared partner data + GPUs are available (see data-strategy, §6).

## Quick start (registry + eval, no GPU)

```bash
cd backend
pip install numpy scikit-learn pytest
python -m pytest ml_engine/tests -q

# end-to-end MLOps flow
python -m ml_engine.cli register --name mr-report-gen --version 0.1.0 --stage report_gen
python -m ml_engine.cli eval --samples ml_engine/tests/data/sample_eval.json \
    --test-set frozen-v1 --model mr-report-gen:0.1.0     # runs promotion gates
python -m ml_engine.cli promote  --model mr-report-gen:0.1.0   # -> staging
python -m ml_engine.cli sign-off --model mr-report-gen:0.1.0 --reviewer dr.x
python -m ml_engine.cli promote  --model mr-report-gen:0.1.0   # -> production (locked)
python -m ml_engine.cli list
```

## Promotion gates (`config/settings.py`, override via `AMAN_ML_*`)

Triage **sensitivity ≥ 0.95** (safety-critical), AUROC ≥ 0.85, RadGraph F1 ≥ 0.40,
CheXbert F1 ≥ 0.50, ECE ≤ 0.10, fairness gap ≤ 0.10. A model reaches
`PRODUCTION` only after passing the gate **and** reader-study sign-off; it is
then locked for the regulated path (§7.4).

## Design docs

`docs/encoder-scrum-21.md` … `docs/mlops-scrum-27.md`.
