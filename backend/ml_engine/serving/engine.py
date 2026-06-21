"""Inference engine: encoder -> triage + report generation (§7.5 serving).

Wraps the trained model stages behind a single object the API (or any caller)
uses. Models can be supplied directly (tests) or loaded from the registry +
checkpoints (production). All decisions stay assistive: triage returns
per-finding probabilities + an abstention flag (route to manual review), never
an autonomous diagnosis (decision D2).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Optional

import torch

from ..encoder.encoder import EncoderConfig, MRIEncoder3D
from ..triage_head.classifier import TriageConfig, TriageHead


@dataclass
class TriageResult:
    per_finding: dict[str, float]
    severity: float
    abstain: bool
    top_finding: str


class InferenceEngine:
    """Holds the encoder + triage head (+ optional report generator)."""

    def __init__(self, encoder: MRIEncoder3D, triage: TriageHead,
                 report_generator: Optional[Any] = None, device: str = "cpu"):
        self.dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
        self.encoder = encoder.to(self.dev).eval()
        self.triage = triage.to(self.dev).eval()
        self.report_generator = report_generator
        self.findings = triage.cfg.critical_findings

    @torch.no_grad()
    def features(self, volume: torch.Tensor) -> torch.Tensor:
        if volume.ndim == 4:
            volume = volume.unsqueeze(0)            # add batch dim
        return self.encoder.encode(volume.to(self.dev))

    @torch.no_grad()
    def triage_study(self, volume: torch.Tensor) -> TriageResult:
        out = self.triage.predict(self.features(volume))
        probs = out["probs"][0]
        idx = int(out["top_finding_idx"][0])
        return TriageResult(
            per_finding={f: round(float(probs[i]), 4) for i, f in enumerate(self.findings)},
            severity=round(float(out["severity"][0]), 4),
            abstain=bool(out["abstain"][0]),
            top_finding=self.findings[idx],
        )

    @torch.no_grad()
    def report_study(self, volume: torch.Tensor, prompt: str = "Findings:") -> dict:
        if self.report_generator is None:
            raise RuntimeError("no report generator attached")
        if volume.ndim == 4:
            volume = volume.unsqueeze(0)
        out = self.report_generator.generate(volume.to(self.dev), prompt=prompt)
        return {"report": out["text"][0] if out["text"] else ""}

    # ---- construction helpers ---------------------------------------------
    @classmethod
    def from_checkpoints(cls, encoder_ckpt: str, triage_ckpt: str,
                         device: str = "cpu") -> "InferenceEngine":
        enc_state = torch.load(encoder_ckpt, map_location="cpu", weights_only=False)
        cfg = EncoderConfig(**enc_state["cfg"]) if "cfg" in enc_state else EncoderConfig()
        encoder = MRIEncoder3D(cfg)
        encoder.load_pretrained(encoder_ckpt)
        tri_state = torch.load(triage_ckpt, map_location="cpu", weights_only=False)
        tcfg = TriageConfig(**{k: v for k, v in tri_state["cfg"].items()
                               if k in TriageConfig.__dataclass_fields__})
        triage = TriageHead(in_dim=tri_state.get("in_dim", cfg.embed_dim), cfg=tcfg)
        triage.load_state_dict(tri_state["model"])
        return cls(encoder, triage, device=device)
