"""Triage detection metrics (SCRUM-24/26, §7.3).

Triage is a detection problem. The safety-critical gate is **sensitivity ≥ 0.95**
on critical findings. AUROC uses scikit-learn when available (it is in the
backend deps) and falls back to a NumPy rank-based computation otherwise.
"""
from __future__ import annotations

from typing import Optional, Sequence

import numpy as np


def confusion(y_true: Sequence[int], y_pred: Sequence[int]) -> tuple[int, int, int, int]:
    yt = np.asarray(y_true, dtype=int)
    yp = np.asarray(y_pred, dtype=int)
    tp = int(np.sum((yt == 1) & (yp == 1)))
    tn = int(np.sum((yt == 0) & (yp == 0)))
    fp = int(np.sum((yt == 0) & (yp == 1)))
    fn = int(np.sum((yt == 1) & (yp == 0)))
    return tp, tn, fp, fn


def sensitivity(y_true: Sequence[int], y_pred: Sequence[int]) -> float:
    tp, _tn, _fp, fn = confusion(y_true, y_pred)
    return tp / (tp + fn) if (tp + fn) else float("nan")


def specificity(y_true: Sequence[int], y_pred: Sequence[int]) -> float:
    _tp, tn, fp, _fn = confusion(y_true, y_pred)
    return tn / (tn + fp) if (tn + fp) else float("nan")


def precision(y_true: Sequence[int], y_pred: Sequence[int]) -> float:
    tp, _tn, fp, _fn = confusion(y_true, y_pred)
    return tp / (tp + fp) if (tp + fp) else float("nan")


def auroc(y_true: Sequence[int], y_score: Sequence[float]) -> float:
    yt = np.asarray(y_true, dtype=int)
    ys = np.asarray(y_score, dtype=float)
    if len(np.unique(yt)) < 2:
        return float("nan")
    try:
        from sklearn.metrics import roc_auc_score  # type: ignore
        return float(roc_auc_score(yt, ys))
    except Exception:
        # Mann-Whitney U / rank-based AUROC.
        order = np.argsort(ys, kind="mergesort")
        ranks = np.empty_like(order, dtype=float)
        ranks[order] = np.arange(1, len(ys) + 1)
        # average ranks for ties
        _, inv, counts = np.unique(ys, return_inverse=True, return_counts=True)
        sums = np.zeros(len(counts))
        np.add.at(sums, inv, ranks)
        avg = sums / counts
        ranks = avg[inv]
        n_pos = int(np.sum(yt == 1))
        n_neg = int(np.sum(yt == 0))
        sum_pos = float(np.sum(ranks[yt == 1]))
        return (sum_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def time_to_flag(times_seconds: Sequence[float]) -> dict[str, float]:
    """Summary of latency from study receipt to triage flag (NFR-01 ≤ 5 min)."""
    t = np.asarray([x for x in times_seconds if x is not None], dtype=float)
    if t.size == 0:
        return {"mean": float("nan"), "p95": float("nan"), "max": float("nan")}
    return {"mean": float(np.mean(t)), "p95": float(np.percentile(t, 95)), "max": float(np.max(t))}


def all_triage_metrics(
    y_true: Sequence[int],
    y_score: Sequence[float],
    threshold: float = 0.5,
    times_seconds: Optional[Sequence[float]] = None,
) -> dict[str, float]:
    y_pred = [1 if s >= threshold else 0 for s in y_score]
    metrics = {
        "triage.sensitivity": sensitivity(y_true, y_pred),
        "triage.specificity": specificity(y_true, y_pred),
        "triage.precision": precision(y_true, y_pred),
        "triage.auroc": auroc(y_true, y_score),
    }
    if times_seconds is not None:
        ttf = time_to_flag(times_seconds)
        metrics["triage.time_to_flag_mean_s"] = ttf["mean"]
        metrics["triage.time_to_flag_p95_s"] = ttf["p95"]
    return metrics
