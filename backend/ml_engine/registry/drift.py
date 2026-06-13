"""Post-deployment drift monitoring (SCRUM-27, §7.4-7.5).

Monitors two things from the SRS:
  * **input-distribution drift** — are incoming studies unlike the training
    distribution? (feeds OOD/abstention, FR-14)
  * **proxy-quality drift** — is a proxy signal (e.g. radiologist edit rate,
    triage confidence) regressing over time?

Implements Population Stability Index (PSI) and a two-sample
Kolmogorov-Smirnov statistic in NumPy (no SciPy dependency). Emits
:class:`DriftAlert`s and a recommended action (``monitor`` / ``alert`` /
``rollback``).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Sequence

import numpy as np


class DriftAction(str, Enum):
    OK = "ok"
    MONITOR = "monitor"
    ALERT = "alert"
    ROLLBACK = "rollback"


@dataclass
class DriftAlert:
    feature: str
    metric: str          # "psi" | "ks"
    value: float
    threshold: float
    action: DriftAction
    message: str


@dataclass
class DriftReport:
    alerts: list[DriftAlert] = field(default_factory=list)
    action: DriftAction = DriftAction.OK

    @property
    def triggered(self) -> bool:
        return self.action in (DriftAction.ALERT, DriftAction.ROLLBACK)


def population_stability_index(
    reference: Sequence[float], current: Sequence[float], bins: int = 10
) -> float:
    """PSI between a reference and current sample.

    Rule of thumb: <0.1 no shift, 0.1-0.25 moderate, >0.25 significant.
    """
    ref = np.asarray(reference, dtype=float)
    cur = np.asarray(current, dtype=float)
    if ref.size == 0 or cur.size == 0:
        return float("nan")
    # Quantile bin edges from the reference distribution.
    quantiles = np.linspace(0, 1, bins + 1)
    edges = np.unique(np.quantile(ref, quantiles))
    if edges.size < 2:
        return 0.0
    edges[0], edges[-1] = -np.inf, np.inf
    ref_pct = np.histogram(ref, bins=edges)[0] / ref.size
    cur_pct = np.histogram(cur, bins=edges)[0] / cur.size
    eps = 1e-6
    ref_pct = np.clip(ref_pct, eps, None)
    cur_pct = np.clip(cur_pct, eps, None)
    return float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))


def ks_statistic(reference: Sequence[float], current: Sequence[float]) -> float:
    """Two-sample Kolmogorov-Smirnov statistic (max CDF gap), in NumPy."""
    ref = np.sort(np.asarray(reference, dtype=float))
    cur = np.sort(np.asarray(current, dtype=float))
    if ref.size == 0 or cur.size == 0:
        return float("nan")
    grid = np.concatenate([ref, cur])
    cdf_ref = np.searchsorted(ref, grid, side="right") / ref.size
    cdf_cur = np.searchsorted(cur, grid, side="right") / cur.size
    return float(np.max(np.abs(cdf_ref - cdf_cur)))


class DriftMonitor:
    """Compare a live window of features against the model's training reference.

    Parameters
    ----------
    psi_alert, psi_rollback
        PSI thresholds. >= ``psi_rollback`` recommends a rollback.
    ks_alert
        KS threshold for an alert.
    """

    def __init__(
        self,
        reference: dict[str, Sequence[float]],
        *,
        psi_alert: float = 0.25,
        psi_rollback: float = 0.40,
        ks_alert: float = 0.30,
    ):
        self.reference = {k: np.asarray(v, dtype=float) for k, v in reference.items()}
        self.psi_alert = psi_alert
        self.psi_rollback = psi_rollback
        self.ks_alert = ks_alert

    def check(self, current: dict[str, Sequence[float]]) -> DriftReport:
        report = DriftReport()
        worst = DriftAction.OK
        order = {DriftAction.OK: 0, DriftAction.MONITOR: 1, DriftAction.ALERT: 2, DriftAction.ROLLBACK: 3}

        for feature, ref in self.reference.items():
            if feature not in current:
                continue
            cur = current[feature]
            psi = population_stability_index(ref, cur)
            ks = ks_statistic(ref, cur)

            if not np.isnan(psi):
                if psi >= self.psi_rollback:
                    a = DriftAction.ROLLBACK
                elif psi >= self.psi_alert:
                    a = DriftAction.ALERT
                elif psi >= 0.1:
                    a = DriftAction.MONITOR
                else:
                    a = DriftAction.OK
                if a != DriftAction.OK:
                    report.alerts.append(DriftAlert(
                        feature, "psi", psi,
                        self.psi_rollback if a == DriftAction.ROLLBACK else self.psi_alert,
                        a, f"PSI {psi:.3f} on '{feature}' -> {a.value}",
                    ))
                if order[a] > order[worst]:
                    worst = a

            if not np.isnan(ks) and ks >= self.ks_alert:
                report.alerts.append(DriftAlert(
                    feature, "ks", ks, self.ks_alert, DriftAction.ALERT,
                    f"KS {ks:.3f} on '{feature}' exceeds {self.ks_alert}",
                ))
                if order[DriftAction.ALERT] > order[worst]:
                    worst = DriftAction.ALERT

        report.action = worst
        return report
