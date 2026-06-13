# SCRUM-23 — Report Generator (LLM + LoRA)

Epic: SCRUM-7. ТЗ §7.1 Stage C, §7.3, §7.5. Code: `backend/ml_engine/report_gen/`.

## Goal

Generate a structured draft report (Findings + Impression) grounded in the
images, so the radiologist reviews/edits instead of dictating from scratch (UC-1).

## Design

- `VisualProjector` — cross-attends learnable queries over encoder patch tokens
  to produce a fixed set of "visual tokens" in the LLM embedding space.
- `ReportGenerator` — encoder → projector → LoRA-adapted causal LLM
  (`attach_llm()` wires transformers + peft lazily).
- `StructuredFinding` — machine-readable finding (label, anatomy, laterality,
  measurement, confidence, presence) emitted alongside prose (FR-06).
- Output constrained to a findings vocabulary; grounded in image evidence;
  uncertainty surfaced (§7.5). OOD abstention handled upstream (FR-14).

## Acceptance Criteria

- Aligned encoder → LLM via projection; LoRA fine-tuning on (volume → report).
- Structured Findings + Impression; grounded + vocabulary-constrained output.
- **RadGraph F1 ≥ gate** on the frozen test set (enforced by SCRUM-26 + SCRUM-27).

## What Is Real

- Encoder→visual-token projection module (PyTorch); LoRA config; structured
  finding schema; RadGraph-F1 gate already implemented in the eval harness.

## What Is Mocked / Pending

- `generate()` / constrained decoding wired at the training milestone (needs LLM
  weights + paired data). Marked `NotImplementedError` until then.

## Production Follow-Ups

- Constrained decoding against findings vocabulary; Findings/Impression parser.
- LoRA fine-tune on cleared (volume → report) pairs; gate on RadGraph F1.
