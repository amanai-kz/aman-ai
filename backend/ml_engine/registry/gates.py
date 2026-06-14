"""Promotion gates (SCRUM-27, §7.3-7.4).

A model only advances toward production if its :class:`EvalReport` clears every
gate. The triage **sensitivity** gate is the safety-critical one (a missed
critical finding is a high-severity harm, §14).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from ..config import EvalGates, gates as default_gates
from .models import EvalReport


@dataclass
class GateResult:
    passed: bool
    failures: list[str]
    checked: dict[str, bool]


def _ok(value: float) -> bool:
    return value is not None and not math.isnan(value)


def check_gates(report: EvalReport, gate_cfg: EvalGates | None = None) -> GateResult:
    """Evaluate ``report.metrics`` against ``gate_cfg``.

    Missing metrics fail their gate (you cannot pass a gate you did not measure).
    """
    g = gate_cfg or default_gates
    failures: list[str] = []
    checked: dict[str, bool] = {}

    def require_min(metric_key: str, threshold: float, label: str) -> None:
        v = report.metrics.get(metric_key, float("nan"))
        ok = _ok(v) and v >= threshold
        checked[label] = ok
        if not ok:
            shown = "missing" if not _ok(v) else f"{v:.4f}"
            failures.append(f"{label}: {shown} < {threshold:.4f}")

    def require_max(metric_key: str, threshold: float, label: str) -> None:
        v = report.metrics.get(metric_key, float("nan"))
        ok = _ok(v) and v <= threshold
        checked[label] = ok
        if not ok:
            shown = "missing" if not _ok(v) else f"{v:.4f}"
            failures.append(f"{label}: {shown} > {threshold:.4f}")

    # Triage detection — safety critical.
    require_min("triage.sensitivity", g.triage_sensitivity_min, "triage_sensitivity")
    require_min("triage.auroc", g.triage_auroc_min, "triage_auroc")
    # Report clinical efficacy.
    require_min("report.radgraph_f1", g.radgraph_f1_min, "radgraph_f1")
    require_min("report.chexbert_f1", g.chexbert_f1_min, "chexbert_f1")
    # Calibration (lower is better).
    require_max("calibration.ece", g.ece_max, "ece")

    # Fairness — gap between best and worst subgroup on the primary triage metric.
    gap = _max_subgroup_gap(report, "triage.sensitivity")
    if gap is not None:
        ok = gap <= g.fairness_max_gap
        checked["fairness_gap"] = ok
        if not ok:
            failures.append(f"fairness_gap: {gap:.4f} > {g.fairness_max_gap:.4f}")

    return GateResult(passed=len(failures) == 0, failures=failures, checked=checked)


def _max_subgroup_gap(report: EvalReport, metric_key: str) -> float | None:
    """Largest best-vs-worst gap of ``metric_key`` across all subgroup axes."""
    worst_gap: float | None = None
    for _axis, groups in report.subgroup_metrics.items():
        vals = [m.get(metric_key) for m in groups.values() if isinstance(m, dict)]
        vals = [v for v in vals if _ok(v)]
        if len(vals) >= 2:
            gap = max(vals) - min(vals)
            worst_gap = gap if worst_gap is None else max(worst_gap, gap)
    return worst_gap
