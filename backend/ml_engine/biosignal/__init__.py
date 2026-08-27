"""SCRUM-68 — S2 biosignal encoder: SSL pretraining on MIMIC ICU vitals.

Importing this package requires PyTorch (a training-time dependency), same as
``ml_engine.encoder``. See ``ml_engine/requirements.txt``.
"""
from .model import BiosignalEncoder1D, BiosignalEncoderConfig, MaskedBiosignalSSL, patchify_1d

__all__ = [
    "BiosignalEncoder1D", "BiosignalEncoderConfig", "MaskedBiosignalSSL", "patchify_1d",
]
