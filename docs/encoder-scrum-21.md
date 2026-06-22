# SCRUM-21 — 3D MRI Encoder: SSL Pretraining on FOMO300K

Epic: SCRUM-7 (MRI AI Engine). ТЗ §7.1 Stage A, §7.2. Code: `backend/ml_engine/encoder/`.

## Goal

A 3D MRI vision encoder, self-supervised on FOMO300K, giving a strong
transferable representation for downstream alignment (SCRUM-22), report
generation (SCRUM-23), and triage (SCRUM-24).

## Design

- `MRIEncoder3D` — patch-embedding 3D ViT. `PatchEmbed3D` (Conv3d) → cls token +
  positional embeddings → `TransformerEncoder` → LayerNorm. Returns
  `patch_tokens` + pooled study embedding. Per-sequence input (`in_channels=1`);
  sequences (T1/T2/FLAIR/SWI) are routed separately per §3.3 FR-03.
- `MaskedVolumeSSL` — MAE-style masked-volume reconstruction head
  (`mask_ratio=0.75`); reconstruction loss computed on masked patches only.
- `MRIEncoder3D.load_pretrained()` — warm-start from FOMO300K published weights.

## Acceptance Criteria

- SSL pretraining (masked-volume / contrastive) on FOMO300K; FOMO weights warm-start.
- Encoder checkpoints versioned in the model registry (SCRUM-27).
- Linear-probe / downstream baseline beats from-scratch on a held-out task.
  **Implemented:** `encoder/linear_probe.py` (see below).

## Linear-probe evaluation (acceptance #3)

`encoder/linear_probe.py` is the downstream check that the SSL representation is
actually useful. Protocol (standard SSL readout):

1. **Freeze** the encoder; extract the pooled study embedding per labelled volume.
2. Standardise features; fit a **linear** classifier (multinomial logistic
   regression, torch-only) on a held-out train split.
3. Score the disjoint test split (accuracy, balanced accuracy, macro-AUROC).

It runs that for the **SSL-pretrained** encoder and a **from-scratch** (random
init, identical architecture) encoder on the *same* split, then reports
`beats_scratch` (decided on balanced accuracy). The comparison is recorded as
its own `stage="linear-probe"` registry card, kept off the triage promotion
gates (an encoder readout should not be scored against `sensitivity ≥ 0.95`).

```bash
# real run: a checkpoint from encoder/train.py + a path,label CSV of held-out labels
python -m ml_engine.encoder.linear_probe --ckpt $CK/mr-encoder-1.0.0-ixi.pt \
    --data-dir data/ixi/image --labels data/ixi/labels.csv --register

# self-contained CPU demonstration (SSL-pretrains a small encoder, then probes it)
python -m ml_engine.encoder.linear_probe --device cpu
```

Exit code is 0 when the pretrained encoder wins, 4 otherwise. The synthetic
demonstration exercises the whole pipeline on CPU; the production verdict comes
from the real run on the IXI-pretrained checkpoint — a sub-second synthetic toy
is trivially separable by random features and cannot stand in for the claim.

## What Is Real

- Full encoder + SSL objective architecture (PyTorch); forward/loss runnable on
  a dummy volume to validate shapes.
- Config-driven (`EncoderConfig`): img/patch size, depth, heads, mask ratio.

## What Is Mocked / Pending

- No training run yet — needs FOMO300K download + multi-GPU host (§7.2).
- Warm-start expects FOMO checkpoint keys; remap layer verified at the training milestone.

## Production Follow-Ups

- DDP/FSDP training loop, mixed precision, gradient checkpointing for 3D volumes.
- Register encoder checkpoints + dataset hash via `ml_engine.registry`.
- Linear-probe evaluation is implemented (`encoder/linear_probe.py`); run it on
  the IXI-pretrained checkpoint with a labelled held-out task to record the
  transfer verdict in the registry.
