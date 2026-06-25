"""Out-of-distribution detection for input studies (FR-14, §4.3, §7.5).

The triage head's *abstention* handles predictive uncertainty; this handles
**input-distribution** OOD — unsupported sequences, wrong body part, or scanners
far from the training distribution. Such studies must get **no AI draft** and be
routed to manual review (FR-14, §4.3), not a hallucinated finding.

Method: a Mahalanobis detector (Lee et al., 2018) on the encoder's pooled
features — fit a Gaussian (mean + shrinkage covariance) on in-distribution
features, score new studies by Mahalanobis distance, and threshold at a level
calibrated to a target in-distribution false-positive rate. Dependency-light
(torch + numpy); no extra model to train.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import torch


@dataclass
class OODVerdict:
    is_ood: bool
    score: float          # Mahalanobis distance
    threshold: float
    reason: str


class MahalanobisOOD:
    """Gaussian (Mahalanobis) OOD detector over pooled encoder features."""

    def __init__(self, shrinkage: float = 0.1):
        self.shrinkage = float(shrinkage)
        self.mean_: np.ndarray | None = None
        self.precision_: np.ndarray | None = None
        self.threshold_: float | None = None

    # ---- fit / calibrate ---------------------------------------------------
    def fit(self, features: np.ndarray | torch.Tensor) -> "MahalanobisOOD":
        X = _to_np(features)
        if X.ndim != 2 or X.shape[0] < 2:
            raise ValueError("need at least 2 in-distribution feature vectors")
        self.mean_ = X.mean(axis=0)
        cov = np.cov(X, rowvar=False)
        d = cov.shape[0]
        # Ledoit-Wolf-style shrinkage towards a scaled identity -> invertible
        # even when n < d (the realistic regime for a small reference set).
        mu_diag = np.trace(cov) / d
        cov_shrunk = (1.0 - self.shrinkage) * cov + self.shrinkage * mu_diag * np.eye(d)
        self.precision_ = np.linalg.pinv(cov_shrunk)
        return self

    def calibrate(self, in_dist_features: np.ndarray | torch.Tensor,
                  target_fpr: float = 0.05) -> float:
        """Set the threshold at the (1 - target_fpr) quantile of in-dist scores,
        so ~target_fpr of in-distribution studies are (wrongly) flagged OOD."""
        scores = self.score(in_dist_features)
        self.threshold_ = float(np.quantile(scores, 1.0 - target_fpr))
        return self.threshold_

    # ---- scoring -----------------------------------------------------------
    def score(self, features: np.ndarray | torch.Tensor) -> np.ndarray:
        if self.mean_ is None or self.precision_ is None:
            raise RuntimeError("detector not fitted; call fit() first")
        X = _to_np(features)
        if X.ndim == 1:
            X = X[None, :]
        delta = X - self.mean_
        m = np.einsum("ij,jk,ik->i", delta, self.precision_, delta)
        return np.sqrt(np.clip(m, 0.0, None))

    def verdict(self, feature: np.ndarray | torch.Tensor) -> OODVerdict:
        if self.threshold_ is None:
            raise RuntimeError("detector not calibrated; call calibrate() first")
        s = float(self.score(feature)[0])
        ood = s > self.threshold_
        reason = ("out-of-distribution input — routed to manual review, no AI draft (FR-14)"
                  if ood else "in-distribution")
        return OODVerdict(is_ood=ood, score=s, threshold=self.threshold_, reason=reason)

    # ---- evaluation --------------------------------------------------------
    def auroc(self, in_features, ood_features) -> float:
        """Detection AUROC separating in-distribution from OOD by score."""
        si = self.score(in_features)
        so = self.score(ood_features)
        pos, neg = so, si           # OOD = positive class (higher score)
        gt = (pos[:, None] > neg[None, :]).mean()
        return float(gt)


def fit_from_feature_batches(batches: Iterable[torch.Tensor], *,
                             target_fpr: float = 0.05,
                             shrinkage: float = 0.1) -> MahalanobisOOD:
    """Fit + calibrate from an iterable of pooled-feature tensors (B, D)."""
    feats = torch.cat([b.detach().cpu().reshape(b.shape[0], -1) for b in batches], 0)
    det = MahalanobisOOD(shrinkage=shrinkage).fit(feats)
    det.calibrate(feats, target_fpr=target_fpr)
    return det


def _to_np(x) -> np.ndarray:
    if isinstance(x, torch.Tensor):
        return x.detach().cpu().float().numpy()
    return np.asarray(x, dtype=np.float64)
