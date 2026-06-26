"""Structured, machine-readable findings with uncertainty (FR-06, FR-15, §7.3).

Emits per-finding records — label, calibrated confidence, a confidence interval,
laterality, severity, evidence slices, and the model version + an explicit
AI-generated flag (FR-15) — alongside the prose triage. The confidence interval
is **epistemic**, via MC-dropout (Gal & Ghahramani, 2016): keep the head's dropout
active and sample N stochastic forward passes, then take the calibrated-probability
percentiles. Assistive only — every record requires radiologist sign-off (D2).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

import torch
import torch.nn as nn


@dataclass
class StructuredFinding:
    label: str
    confidence: float           # calibrated probability (point estimate)
    ci_low: float               # 95% epistemic CI (MC-dropout)
    ci_high: float
    laterality: str             # "left" | "right" | "midline" | "n/a"
    severity: str               # "critical" | "urgent" | "routine"
    flagged: bool               # confidence >= decision threshold
    evidence_slices: list[int] = field(default_factory=list)
    ai_generated: bool = True   # FR-15 — always an AI artifact
    model_version: str = ""     # FR-15 — provenance on every artifact

    def to_dict(self) -> dict:
        return asdict(self)


def _enable_mc_dropout(module: nn.Module) -> None:
    for m in module.modules():
        if isinstance(m, (nn.Dropout, nn.Dropout1d, nn.Dropout2d, nn.Dropout3d)):
            m.train()


def mc_dropout_probs(engine, features: torch.Tensor, n_samples: int = 20) -> torch.Tensor:
    """N calibrated-probability samples (n_samples, n_findings) via MC-dropout."""
    head = engine.triage
    was_training = head.training
    head.eval()
    _enable_mc_dropout(head)                 # dropout ON, everything else eval
    samples = []
    with torch.no_grad():
        for _ in range(n_samples):
            logits = head.calibrator(head(features))
            samples.append(torch.sigmoid(logits))
    if was_training:
        head.train()
    else:
        head.eval()
    return torch.cat(samples, dim=0)         # (n_samples, n_findings)


def _severity(p: float) -> str:
    if p >= 0.70:
        return "critical"
    if p >= 0.40:
        return "urgent"
    return "routine"


def structured_findings(engine, volume: torch.Tensor, *, n_mc: int = 20,
                        threshold: float = 0.5, with_saliency: bool = True,
                        model_version: str = "") -> list[StructuredFinding]:
    model_version = model_version or getattr(engine, "model_version", "")  # FR-15
    feats = engine.features(volume)                       # deterministic pooled (no_grad)
    samples = mc_dropout_probs(engine, feats, n_mc)       # (n_mc, n_findings)
    mean = samples.mean(dim=0)
    lo = torch.quantile(samples, 0.025, dim=0)
    hi = torch.quantile(samples, 0.975, dim=0)
    out: list[StructuredFinding] = []
    for i, name in enumerate(engine.findings):
        p = float(mean[i])
        flagged = p >= threshold
        lat, slices = "n/a", []
        if flagged and with_saliency:
            try:
                from .saliency import finding_saliency
                s = finding_saliency(engine, volume, i)
                lat, slices = s.laterality, s.top_slices
            except Exception:                              # never let evidence break triage
                lat, slices = "n/a", []
        out.append(StructuredFinding(
            label=name, confidence=round(p, 4),
            ci_low=round(float(lo[i]), 4), ci_high=round(float(hi[i]), 4),
            laterality=lat, severity=_severity(p), flagged=flagged,
            evidence_slices=slices, model_version=model_version,
        ))
    return out
