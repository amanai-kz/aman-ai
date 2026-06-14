"""SCRUM-22 — Image-text alignment (MR-CLIP) on report-paired data (Stage B).

Requires PyTorch. Uses MR-RATE for research/benchmark only (CC BY-NC-SA;
see data-strategy / §6.2). Production alignment trains on commercially-cleared
report-paired data.
"""
from .mr_clip import MRCLIP, MRCLIPConfig, info_nce_loss

__all__ = ["MRCLIP", "MRCLIPConfig", "info_nce_loss"]
