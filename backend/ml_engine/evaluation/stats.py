"""Statistical-rigor utilities for evaluation (SCRUM-26, §7.3).

Point estimates are not enough for a clinical / regulator / journal-grade
evaluation: every headline metric needs an uncertainty interval, and the
safety-critical **sensitivity** gate should be judged on a *lower confidence
bound*, not a lucky point estimate.

This module provides, dependency-light (numpy + stdlib; scipy used only if it
happens to be installed):
  * :func:`clopper_pearson` — exact binomial CI for a proportion (sensitivity,
    specificity); the standard "exact" interval regulators expect.
  * :func:`wilson_interval` — closed-form score interval (no scipy), used as the
    Clopper-Pearson fallback and a good default for proportions.
  * :func:`bootstrap_ci` — percentile bootstrap CI for any statistic (AUROC,
    accuracy, NLG metrics) over resampled cases.
"""
from __future__ import annotations

import math
import statistics
from typing import Callable

import numpy as np


def _z(alpha: float) -> float:
    """Two-sided normal critical value (stdlib inverse-normal, no scipy)."""
    return statistics.NormalDist().inv_cdf(1.0 - alpha / 2.0)


def wilson_interval(k: int, n: int, alpha: float = 0.05) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion k/n. Closed-form."""
    if n <= 0:
        return (0.0, 1.0)
    k = max(0, min(int(k), int(n)))
    z = _z(alpha)
    p = k / n
    denom = 1.0 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = (z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
    return (max(0.0, center - half), min(1.0, center + half))


def clopper_pearson(k: int, n: int, alpha: float = 0.05) -> tuple[float, float]:
    """Exact (Clopper-Pearson) binomial CI for a proportion k/n.

    Uses the Beta-quantile form via scipy when available; otherwise falls back to
    the Wilson score interval (close, and dependency-free).
    """
    if n <= 0:
        return (0.0, 1.0)
    k = max(0, min(int(k), int(n)))
    try:
        from scipy.stats import beta  # type: ignore
    except Exception:
        return wilson_interval(k, n, alpha)
    lower = 0.0 if k == 0 else float(beta.ppf(alpha / 2.0, k, n - k + 1))
    upper = 1.0 if k == n else float(beta.ppf(1.0 - alpha / 2.0, k + 1, n - k))
    return (lower, upper)


def bootstrap_ci(
    statistic_fn: Callable[[np.ndarray], float],
    n: int,
    *,
    n_boot: int = 1000,
    alpha: float = 0.05,
    seed: int = 0,
) -> tuple[float, float, float]:
    """Percentile bootstrap CI for a statistic computed over case indices.

    ``statistic_fn`` maps an array of resampled row indices to a scalar (so it
    works for paired data like AUROC over (y_true, y_score)). Returns
    ``(point_estimate, ci_low, ci_high)``; NaN bootstrap draws (e.g. a resample
    with a single class) are dropped before taking percentiles.
    """
    if n <= 0:
        return (float("nan"), float("nan"), float("nan"))
    point = float(statistic_fn(np.arange(n)))
    rng = np.random.default_rng(seed)
    draws: list[float] = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, size=n)
        val = statistic_fn(idx)
        if val == val:  # not NaN
            draws.append(float(val))
    if len(draws) < max(20, n_boot // 10):
        return (point, float("nan"), float("nan"))
    lo = float(np.percentile(draws, 100 * alpha / 2.0))
    hi = float(np.percentile(draws, 100 * (1.0 - alpha / 2.0)))
    return (point, lo, hi)
