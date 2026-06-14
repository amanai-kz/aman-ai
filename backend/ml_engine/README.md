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
| `augmentation/`| SCRUM-25 | ✅ tagging / API      | (model: torch+monai) |
| `config/`      | —        | settings + gates      | stdlib |
| `cli/`         | —        | MLOps CLI             | — |

✅ = runnable + unit-tested. Each stage has a working training loop
(`<package>/train.py`) that runs on GPU and versions its checkpoint in the
registry. The loops use **synthetic placeholder data** so they run today; real
training swaps in FOMO300K / a commercially-cleared partner dataset (and, for
report-gen, the gated Llama weights) — see data-strategy §6.2 / decision D10.
Verified on 2× NVIDIA A10.

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

# SCRUM-21 — encoder SSL pretraining (masked-volume), multi-GPU + AMP
python -m ml_engine.encoder.train --amp --data-parallel --register \
    --name mr-encoder --version 0.1.0-ssl --out $CK

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

## Promotion gates (`config/settings.py`, override via `AMAN_ML_*`)

Triage **sensitivity ≥ 0.95** (safety-critical), AUROC ≥ 0.85, RadGraph F1 ≥ 0.40,
CheXbert F1 ≥ 0.50, ECE ≤ 0.10, fairness gap ≤ 0.10. A model reaches
`PRODUCTION` only after passing the gate **and** reader-study sign-off; it is
then locked for the regulated path (§7.4).

## Design docs

`docs/encoder-scrum-21.md` … `docs/mlops-scrum-27.md`.
