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
- Linear-probe evaluation harness hook to prove transfer over from-scratch.
