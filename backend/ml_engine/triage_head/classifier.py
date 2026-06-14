"""Calibrated triage classifier (SCRUM-24, §7.1 Stage D, §7.3, §7.5).

A lightweight multi-label head on the encoder's pooled features, followed by
temperature scaling for calibration. At inference it returns per-finding
probabilities, an overall severity, and an **abstention** flag when confidence
falls in an uncertain band (route to manual review rather than guess).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class TriageConfig:
    critical_findings: tuple[str, ...] = (
        "intracranial_hemorrhage", "mass_effect", "acute_infarct",
    )
    hidden_dim: int = 256
    dropout: float = 0.1
    # Abstain when the max critical probability is in (abstain_low, abstain_high)
    # — neither confidently positive nor confidently negative.
    abstain_low: float = 0.30
    abstain_high: float = 0.70

    @property
    def num_classes(self) -> int:
        return len(self.critical_findings)


class TemperatureScaler(nn.Module):
    """Single-parameter post-hoc calibration (Guo et al., 2017)."""

    def __init__(self):
        super().__init__()
        self.log_temp = nn.Parameter(torch.zeros(1))

    @property
    def temperature(self) -> torch.Tensor:
        return self.log_temp.exp()

    def forward(self, logits: torch.Tensor) -> torch.Tensor:
        return logits / self.temperature

    def fit(self, logits: torch.Tensor, targets: torch.Tensor, max_iter: int = 100) -> float:
        """Optimise temperature on a held-out validation split (BCE)."""
        opt = torch.optim.LBFGS([self.log_temp], lr=0.01, max_iter=max_iter)

        def closure():
            opt.zero_grad()
            loss = F.binary_cross_entropy_with_logits(self.forward(logits), targets)
            loss.backward()
            return loss

        opt.step(closure)
        return float(self.temperature.item())


class TriageHead(nn.Module):
    def __init__(self, in_dim: int, cfg: TriageConfig | None = None):
        super().__init__()
        self.cfg = cfg or TriageConfig()
        self.net = nn.Sequential(
            nn.Linear(in_dim, self.cfg.hidden_dim), nn.GELU(),
            nn.Dropout(self.cfg.dropout),
            nn.Linear(self.cfg.hidden_dim, self.cfg.num_classes),
        )
        self.calibrator = TemperatureScaler()

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        """Raw (uncalibrated) logits per critical finding."""
        return self.net(features)

    def predict(self, features: torch.Tensor) -> dict:
        """Calibrated probabilities + severity + abstention decision."""
        logits = self.calibrator(self.forward(features))
        probs = torch.sigmoid(logits)
        max_p, max_idx = probs.max(dim=-1)
        abstain = (max_p > self.cfg.abstain_low) & (max_p < self.cfg.abstain_high)
        return {
            "probs": probs,
            "per_finding": {f: probs[..., i] for i, f in enumerate(self.cfg.critical_findings)},
            "severity": max_p,                 # proxy severity = top critical prob
            "top_finding_idx": max_idx,
            "abstain": abstain,                # True -> route to manual review
        }
