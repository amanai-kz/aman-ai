# SCRUM-22 — Image–Text Alignment (MR-CLIP)

Epic: SCRUM-7. ТЗ §7.1 Stage B. Code: `backend/ml_engine/alignment/`.

## Goal

Contrastively align the 3D MRI encoder's features with radiology-report text
(CT-CLIP-style, adapted to MRI) so the model grounds language in imaging and
supports zero-shot abnormality retrieval/classification.

## Design

- `MRCLIP` — image projection (`encoder.embed_dim → proj_dim`), text projection
  (`text_dim → proj_dim`), learnable `logit_scale` (temperature).
- `info_nce_loss` — symmetric image↔text InfoNCE over a batch (diagonal positives).
- `MRCLIP.zero_shot_logits()` — similarity of a study to class-prompt embeddings.

## Data / Licensing

- Trained on report-paired data. **MR-RATE is research/benchmark ONLY**
  (CC BY-NC-SA, §6.2) — production alignment uses commercially-cleared partner data.

## Acceptance Criteria

- Contrastive image–report training on report-paired data.
- Zero-shot abnormality retrieval/classification baseline reported.
- Alignment checkpoints versioned; eval on the frozen test set.

## What Is Real

- Projection heads, temperature, symmetric InfoNCE, zero-shot scoring (PyTorch).

## What Is Mocked / Pending

- Text encoder is injected as features (`text_dim`); concrete text backbone +
  training loop wired at the training milestone.

## Production Follow-Ups

- Plug a clinical text encoder; build the report-paired loader on cleared data.
- Report zero-shot retrieval metrics through the evaluation harness (SCRUM-26).
