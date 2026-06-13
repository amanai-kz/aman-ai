"""SCRUM-23 — Report generator (LLM + LoRA) for Findings/Impression (Stage C).

Requires PyTorch (+ transformers/peft for the LLM path). The aligned encoder is
connected to an LLM via a projection layer and LoRA-fine-tuned on
(volume -> report) pairs. Output is grounded and constrained to a findings
vocabulary; clinical-efficacy is gated by RadGraph F1 (see evaluation harness).
"""
from .generator import ReportGenerator, ReportGenConfig, StructuredFinding

__all__ = ["ReportGenerator", "ReportGenConfig", "StructuredFinding"]
