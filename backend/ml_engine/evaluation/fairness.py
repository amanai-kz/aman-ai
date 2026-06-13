"""Subgroup / fairness evaluation (SCRUM-26, §7.3).

Breaks a metric down across subgroup axes (scanner, field strength, site, age,
sex) so a material gap between subgroups can block promotion
(see :func:`ml_engine.registry.gates.check_gates`).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Callable, Mapping, Sequence

MetricFn = Callable[[Sequence[int], Sequence[float]], float]


def subgroup_breakdown(
    y_true: Sequence[int],
    y_score: Sequence[float],
    groups: Mapping[str, Sequence],
    metric_fns: Mapping[str, MetricFn],
) -> dict[str, dict[str, dict[str, float]]]:
    """Compute each metric within every subgroup of every axis.

    Parameters
    ----------
    groups
        ``{axis_name: [group_label_per_sample, ...]}``.
    metric_fns
        ``{metric_name: fn(y_true_subset, y_score_subset) -> float}``.

    Returns ``{axis: {group: {metric: value}}}``.
    """
    out: dict[str, dict[str, dict[str, float]]] = {}
    n = len(y_true)
    for axis, labels in groups.items():
        if len(labels) != n:
            continue
        idx_by_group: dict[str, list[int]] = defaultdict(list)
        for i, g in enumerate(labels):
            idx_by_group[str(g)].append(i)
        axis_out: dict[str, dict[str, float]] = {}
        for g, idxs in idx_by_group.items():
            yt = [y_true[i] for i in idxs]
            ys = [y_score[i] for i in idxs]
            axis_out[g] = {name: fn(yt, ys) for name, fn in metric_fns.items()}
            axis_out[g]["n"] = float(len(idxs))
        out[axis] = axis_out
    return out


def flatten_for_gate(
    breakdown: Mapping[str, Mapping[str, Mapping[str, float]]],
    metric_key: str,
) -> dict[str, dict[str, float]]:
    """Reshape into ``{axis: {group: {metric_key: value}}}`` for gate checks."""
    out: dict[str, dict[str, float]] = {}
    for axis, groups in breakdown.items():
        out[axis] = {g: {metric_key: m.get(metric_key, float("nan"))} for g, m in groups.items()}
    return out
