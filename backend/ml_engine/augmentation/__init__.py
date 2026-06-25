"""SCRUM-25 — Synthetic augmentation via NV-Generate-MR-Brain (Stage E).

Generates synthetic brain MRI for rare-pathology and missing-modality balancing
(per the NVIDIA Open Model Licence). **Safety invariant (§7.5):** every synthetic
sample is tagged and isolated — it may enter training but must NEVER surface as a
patient finding. This module enforces the tag at the data-record level.

Public surface:
  * :class:`SyntheticAugmentor` — tagged generation + missing-modality synthesis.
  * generator backends: :class:`NVGenerateMRBrainGenerator` (real, gated) and
    :class:`ProceduralLesionGenerator` (reproducible fallback).
  * :func:`run_rare_class_ablation` — acceptance #3: measurable rare-class gain.
"""
from .synth import (
    SyntheticSample, SyntheticAugmentor, SYNTHETIC_TAG,
    assert_no_synthetic_in_patient_view,
)
from .generators import (
    VolumeGenerator, NVGenerateMRBrainGenerator, ProceduralLesionGenerator,
    default_generator, SEQUENCES,
)
from .ablation import run_rare_class_ablation

__all__ = [
    "SyntheticAugmentor", "SyntheticSample", "SYNTHETIC_TAG",
    "assert_no_synthetic_in_patient_view",
    "VolumeGenerator", "NVGenerateMRBrainGenerator", "ProceduralLesionGenerator",
    "default_generator", "SEQUENCES", "run_rare_class_ablation",
]
