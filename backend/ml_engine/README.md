# MRI AI Engine (Epic SCRUM-7)

Core IP for the Aman AI MRI Radiology Assistant: a 3D MRI vision encoder,
image–text alignment, an LLM report generator, a calibrated triage classifier,
synthetic augmentation, an evaluation harness, and model lifecycle / MLOps.

Reference: SRS/ТЗ §7. Tracks Jira epic **SCRUM-7** (stories SCRUM-21..27).

## Layout

| Package        | Ticket   | Status            | Needs |
|----------------|----------|-------------------|-------|
| `registry/`    | SCRUM-27 | ✅ implemented        | stdlib + numpy |
| `evaluation/`  | SCRUM-26 | ✅ implemented        | numpy, scikit-learn |
| `encoder/`     | SCRUM-21 | ✅ model + SSL train  | torch |
| `alignment/`   | SCRUM-22 | ✅ model + train      | torch |
| `report_gen/`  | SCRUM-23 | ✅ model + LoRA train | torch, transformers, peft |
| `triage_head/` | SCRUM-24 | ✅ train + calibrate  | torch |
| `augmentation/`| SCRUM-25 | implemented + ablation | torch/numpy; NV-Generate gated |
| `config/`      | —        | settings + gates      | stdlib |
| `cli/`         | —        | MLOps CLI             | — |

✅ = runnable + unit-tested. Each stage has a working training loop
(`<package>/train.py`) that runs on GPU and versions its checkpoint in the
registry, plus a FastAPI **serving** layer (`serving/`). Training runs on **real
brain MRI** (`--data-dir`; `encoder/data.py` fetches the open IXITiny set) or
on synthetic data when no dir is given. Report-gen defaults to an **ungated**
Apache-2.0 LLM (Qwen2.5); swap `--llm` to the gated Llama once a token/licence
is in place. The *production* model still needs a commercially-cleared partner
dataset (decision D10). Verified on 2× NVIDIA A10.

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

## Training the model stages (GPU)

```bash
pip install torch transformers peft monai     # GPU host
CK=checkpoints

# SCRUM-21 — encoder SSL pretraining (masked-volume), multi-GPU + AMP.
# On real brain MRI (auto-fetches the open IXITiny set), else synthetic:
python -c "from ml_engine.encoder.data import fetch_ixi_tiny; fetch_ixi_tiny('data/ixi')"
python -m ml_engine.encoder.train --amp --data-parallel --register \
    --data-dir data/ixi/image --name mr-encoder --version 1.0.0-ixi --out $CK

# SCRUM-21 acceptance #3 — linear-probe: does the SSL encoder beat from-scratch?
# Freezes the encoder, probes a labelled held-out task (path,label CSV); records
# the verdict as a stage="linear-probe" registry card. Omit --ckpt for a CPU demo.
python -m ml_engine.encoder.linear_probe --register \
    --ckpt $CK/mr-encoder-1.0.0-ixi.pt --data-dir data/ixi/image --labels data/ixi/labels.csv

# SCRUM-22 — contrastive image–text alignment, warm-started from the SSL encoder
python -m ml_engine.alignment.train --amp --register \
    --encoder-ckpt $CK/mr-encoder-0.1.0-ssl.pt --out $CK

# SCRUM-24 — triage head: supervised train + temperature calibration
python -m ml_engine.triage_head.train --register --out $CK

# SCRUM-23 — report generator LoRA fine-tune (override --llm to the gated Llama
# once an HF token + accepted licence are in place)
python -m ml_engine.report_gen.train --register --out $CK \
    --llm hf-internal-testing/tiny-random-LlamaForCausalLM
```

Each `--register` versions the resulting checkpoint in the model registry, so it
flows straight into the `eval → promote → sign-off` lifecycle above.

## Stage E — Synthetic augmentation (`augmentation/`, SCRUM-25, §7.1/§7.5)

Two interchangeable backends behind one `VolumeGenerator`: the real
`NVGenerateMRBrainGenerator` (NVIDIA 3D latent-diffusion, gated — activates only
when `AMAN_ML_NVGEN_DIR` + MONAI are present; NVIDIA Open Model Licence, verify
for prod per §6.2) and a reproducible numpy `ProceduralLesionGenerator` fallback
so the pipeline and ablation run without the gated weights. Every synthetic
sample is **tagged and isolated** — `assert_no_synthetic_in_patient_view` blocks
it from ever surfacing as a patient finding (§7.5). Also supports
missing-modality synthesis.

**Acceptance #3 — ablation shows measurable rare-class gain.** A critical finding
is made severely under-represented; the triage head is trained without vs with
synthetic, tagged rare-class positives and scored on a balanced test set:

```bash
python -m ml_engine.augmentation.ablation --register   # registers mr-synthetic-aug
```

Result (seed 0): rare-class **sensitivity 0.23 → 0.70 (+0.47)**, AUROC 0.94 → 0.99,
specificity held at ~1.0 — measurable gain, acceptance satisfied. Also shown live
as section 6 of `scripts/demo.py`. (Honest framing: features/labels are synthetic
per the triage scaffold; with `--encoder-ckpt` the harness instead encodes
generated volumes through the real Stage-A encoder.)

## Serving (`serving/`, §7.5)

A FastAPI inference service exposes the trained models — assistive only, every
output flagged for radiologist sign-off (decision D2). Mountable standalone or
as a sub-app of the platform backend (it does not touch auth/DB).

```bash
pip install fastapi uvicorn python-multipart
export AMAN_ML_ENCODER_CKPT=$CK/mr-encoder-1.0.0-ixi.pt
export AMAN_ML_TRIAGE_CKPT=$CK/mr-triage-0.1.1.pt
uvicorn ml_engine.serving.app:create_default_app --factory --port 8001
# POST /triage  (NIfTI upload) -> per-finding probs + abstention
# POST /report  (NIfTI upload) -> draft report   |  GET /models, /healthz
```

## Promotion gates (`config/settings.py`, override via `AMAN_ML_*`)

Triage **sensitivity ≥ 0.95** (safety-critical), AUROC ≥ 0.85, RadGraph F1 ≥ 0.40,
CheXbert F1 ≥ 0.50, ECE ≤ 0.10, fairness gap ≤ 0.10. A model reaches
`PRODUCTION` only after passing the gate **and** reader-study sign-off; it is
then locked for the regulated path (§7.4).

## Design docs

`docs/encoder-scrum-21.md` … `docs/mlops-scrum-27.md`.
