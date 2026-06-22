"""Tests for evaluation statistical rigor (CIs) and the optional CI gate."""
import numpy as np

from ml_engine.evaluation import stats
from ml_engine.evaluation.harness import EvalConfig, EvalHarness
from ml_engine.registry.gates import check_gates
from ml_engine.registry.models import EvalReport
from ml_engine.config import EvalGates


# --------------------------------------------------------------------------- #
# Proportion CIs
# --------------------------------------------------------------------------- #
def test_clopper_pearson_brackets_point_and_edges():
    lo, hi = stats.clopper_pearson(50, 100)
    assert 0.0 <= lo < 0.5 < hi <= 1.0
    assert 0.35 < lo < 0.41 and 0.59 < hi < 0.65        # known ~ (0.398, 0.602)
    assert stats.clopper_pearson(10, 10)[1] == 1.0      # all successes -> upper 1
    assert stats.clopper_pearson(0, 10)[0] == 0.0       # no successes -> lower 0
    assert stats.clopper_pearson(5, 0) == (0.0, 1.0)    # n=0 -> uninformative


def test_wilson_interval_sane():
    lo, hi = stats.wilson_interval(8, 10)
    assert 0.0 <= lo < 0.8 < hi <= 1.0
    assert stats.wilson_interval(0, 0) == (0.0, 1.0)


# --------------------------------------------------------------------------- #
# Bootstrap
# --------------------------------------------------------------------------- #
def test_bootstrap_ci_brackets_and_deterministic():
    data = np.array([0, 1] * 50, dtype=float)           # true mean 0.5
    stat = lambda idx: float(data[idx].mean())
    point, lo, hi = stats.bootstrap_ci(stat, len(data), n_boot=500, seed=0)
    assert abs(point - 0.5) < 1e-9
    assert lo < point < hi and 0.3 < lo and hi < 0.7
    # deterministic for a fixed seed
    again = stats.bootstrap_ci(stat, len(data), n_boot=500, seed=0)
    assert (point, lo, hi) == again


# --------------------------------------------------------------------------- #
# Harness integration: CIs appear and bracket the point estimates
# --------------------------------------------------------------------------- #
def _triage_samples():
    samples = []
    for i in range(40):
        pos = i % 2 == 0
        samples.append({"study_id": f"S{i}",
                        "triage": {"y_true": 1 if pos else 0,
                                   "y_score": 0.9 if pos else 0.1}})
    return samples


def test_harness_reports_confidence_intervals():
    report = EvalHarness(EvalConfig(bootstrap_n=200)).evaluate(_triage_samples(), test_set="t")
    m = report.metrics
    for key in ("triage.sensitivity_ci_low", "triage.sensitivity_ci_high",
                "triage.auroc_ci_low", "triage.auroc_ci_high",
                "triage.n", "triage.n_positive"):
        assert key in m
    assert m["triage.sensitivity_ci_low"] <= m["triage.sensitivity"] <= m["triage.sensitivity_ci_high"]
    assert m["triage.auroc_ci_low"] <= m["triage.auroc"] <= m["triage.auroc_ci_high"]
    assert m["triage.n"] == 40.0 and m["triage.n_positive"] == 20.0


# --------------------------------------------------------------------------- #
# Optional CI gate
# --------------------------------------------------------------------------- #
def _passing_metrics():
    return {"triage.sensitivity": 0.96, "triage.auroc": 0.90,
            "report.radgraph_f1": 0.5, "report.chexbert_f1": 0.6,
            "calibration.ece": 0.05, "triage.sensitivity_ci_low": 0.80}


def test_ci_gate_is_opt_in():
    lenient = dict(radgraph_f1_min=0.0, chexbert_f1_min=0.0, triage_sensitivity_min=0.9,
                   triage_auroc_min=0.8, ece_max=1.0, fairness_max_gap=1.0)
    report = EvalReport(metrics=_passing_metrics())
    # default (CI gate disabled) -> passes
    assert check_gates(report, EvalGates(**lenient)).passed
    # enable a strict CI lower-bound gate -> the 0.80 lower bound now fails it
    strict = check_gates(report, EvalGates(**lenient, triage_sensitivity_ci_lower_min=0.99))
    assert not strict.passed
    assert any("ci_low" in f for f in strict.failures)
