"""SCRUM-21 — 3D MRI encoder: self-supervised pretraining on FOMO300K (Stage A).

Importing this package requires PyTorch (a training-time dependency); the
registry and evaluation packages do not. See ``ml_engine/requirements.txt``.
"""
from .encoder import EncoderConfig, MRIEncoder3D, MaskedVolumeSSL

__all__ = ["EncoderConfig", "MRIEncoder3D", "MaskedVolumeSSL"]
