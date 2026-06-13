"""SCRUM-25 — Synthetic augmentation via NV-Generate-MR-Brain (Stage E).

Generates synthetic brain MRI for rare-pathology and missing-modality balancing
(per the NVIDIA Open Model Licence). **Safety invariant (§7.5):** every synthetic
sample is tagged and isolated — it may enter training but must NEVER surface as a
patient finding. This module enforces the tag at the data-record level.
"""
from .synth import SyntheticSample, SyntheticAugmentor, SYNTHETIC_TAG

__all__ = ["SyntheticAugmentor", "SyntheticSample", "SYNTHETIC_TAG"]
