"""Saliency / evidence overlays for triage findings (FR-07, §9.2, §7.5).

Grounds each flagged finding in image evidence: a 3D saliency map (input-gradient
of the finding logit w.r.t. the volume, |grad| pooled over channels) the review UI
can overlay, plus a derived hemisphere/laterality from the saliency centroid.
This is the §7.5 hallucination-mitigation control — every claim points at voxels.

Axis convention: volume is (C, D, H, W); the last axis (W) is taken as the
left–right axis for laterality (document/confirm against the standardisation
orientation in production).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch


@dataclass
class Saliency:
    finding: str
    saliency: Any            # np.ndarray (D, H, W), normalised [0, 1]
    laterality: str          # "left" | "right" | "midline"
    centroid: tuple[float, float, float]   # (z, y, x) of the saliency mass
    top_slices: list[int]    # most-salient axial slice indices (evidence)


def _prep(volume: torch.Tensor) -> torch.Tensor:
    if volume.ndim == 3:
        volume = volume.unsqueeze(0)         # (D,H,W) -> (1,D,H,W) single channel
    if volume.ndim == 4:
        volume = volume.unsqueeze(0)         # (C,D,H,W) -> (1,C,D,H,W)
    return volume


def finding_saliency(engine, volume: torch.Tensor, finding_idx: int,
                     *, top_k_slices: int = 3) -> Saliency:
    """Input-gradient saliency for one critical finding."""
    dev = engine.dev
    vol = _prep(volume).to(dev).clone().requires_grad_(True)
    engine.encoder.eval(); engine.triage.eval()
    with torch.enable_grad():
        feats = engine.encoder.encode(vol)
        logits = engine.triage(feats)                 # raw logits (B, n_findings)
        score = logits[0, finding_idx]
        engine.encoder.zero_grad(set_to_none=True)
        engine.triage.zero_grad(set_to_none=True)
        if vol.grad is not None:
            vol.grad = None
        score.backward()
    grad = vol.grad.detach()[0]                        # (C, D, H, W)
    sal = grad.abs().sum(dim=0)                        # (D, H, W)
    sal = sal - sal.min()
    sal = sal / (sal.max() + 1e-8)
    sal_np = sal.cpu().numpy()

    # centroid of the saliency mass + laterality from the L-R (last) axis
    import numpy as np
    idx = np.indices(sal_np.shape)
    w = sal_np.sum() + 1e-8
    cz = float((idx[0] * sal_np).sum() / w)
    cy = float((idx[1] * sal_np).sum() / w)
    cx = float((idx[2] * sal_np).sum() / w)
    mid = sal_np.shape[2] / 2.0
    rel = (cx - mid) / mid
    laterality = "midline" if abs(rel) < 0.12 else ("right" if rel > 0 else "left")
    per_slice = sal_np.reshape(sal_np.shape[0], -1).sum(axis=1)
    top_slices = [int(i) for i in per_slice.argsort()[::-1][:top_k_slices]]
    return Saliency(finding=engine.findings[finding_idx], saliency=sal_np,
                    laterality=laterality, centroid=(cz, cy, cx), top_slices=top_slices)
