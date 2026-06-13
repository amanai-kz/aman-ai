"""SCRUM-24 — Triage classifier for critical findings (Stage D).

Requires PyTorch. A calibrated classifier head on the encoder features that
flags time-critical findings (ICH, mass effect, acute infarct), surfaces
confidence/abstention, and supplements (never replaces) radiologist review
(FR-05). The sensitivity ≥ 0.95 gate is enforced by the evaluation harness.
"""
from .classifier import TemperatureScaler, TriageConfig, TriageHead

__all__ = ["TriageHead", "TriageConfig", "TemperatureScaler"]
