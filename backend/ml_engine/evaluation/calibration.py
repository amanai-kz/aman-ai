"""Calibration metrics (SCRUM-24/26, §7.3).

A triage model must be **calibrated** and **abstain when uncertain**. We report
Expected Calibration Error (ECE), Maximum Calibration Error (MCE), the Brier
score, and a reliability table for plotting.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np


def expected_calibration_error(
    y_true: Sequence[int], y_prob: Sequence[float], n_bins: int = 10
) -> float:
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_prob, dtype=float)
    if yt.size == 0:
        return float("nan")
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = yt.size
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        mask = (yp > lo) & (yp <= hi) if i > 0 else (yp >= lo) & (yp <= hi)
        if not np.any(mask):
            continue
        conf = float(np.mean(yp[mask]))
        acc = float(np.mean(yt[mask]))
        ece += (np.sum(mask) / n) * abs(acc - conf)
    return float(ece)


def maximum_calibration_error(
    y_true: Sequence[int], y_prob: Sequence[float], n_bins: int = 10
) -> float:
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_prob, dtype=float)
    if yt.size == 0:
        return float("nan")
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    mce = 0.0
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        mask = (yp > lo) & (yp <= hi) if i > 0 else (yp >= lo) & (yp <= hi)
        if not np.any(mask):
            continue
        mce = max(mce, abs(float(np.mean(yt[mask])) - float(np.mean(yp[mask]))))
    return float(mce)


def brier_score(y_true: Sequence[int], y_prob: Sequence[float]) -> float:
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_prob, dtype=float)
    if yt.size == 0:
        return float("nan")
    return float(np.mean((yp - yt) ** 2))


def reliability_table(
    y_true: Sequence[int], y_prob: Sequence[float], n_bins: int = 10
) -> list[dict[str, float]]:
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_prob, dtype=float)
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    table = []
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        mask = (yp > lo) & (yp <= hi) if i > 0 else (yp >= lo) & (yp <= hi)
        count = int(np.sum(mask))
        table.append({
            "bin_lo": float(lo), "bin_hi": float(hi), "count": count,
            "confidence": float(np.mean(yp[mask])) if count else float("nan"),
            "accuracy": float(np.mean(yt[mask])) if count else float("nan"),
        })
    return table


def all_calibration_metrics(
    y_true: Sequence[int], y_prob: Sequence[float], n_bins: int = 10
) -> dict[str, float]:
    return {
        "calibration.ece": expected_calibration_error(y_true, y_prob, n_bins),
        "calibration.mce": maximum_calibration_error(y_true, y_prob, n_bins),
        "calibration.brier": brier_score(y_true, y_prob),
    }
