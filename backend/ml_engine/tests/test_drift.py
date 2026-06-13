"""Tests for drift monitoring (SCRUM-27, §7.5)."""
import random

from ml_engine.registry import DriftMonitor, DriftAction, population_stability_index, ks_statistic


def test_psi_zero_for_same_distribution():
    rng = random.Random(0)
    ref = [rng.gauss(0, 1) for _ in range(2000)]
    cur = [rng.gauss(0, 1) for _ in range(2000)]
    assert population_stability_index(ref, cur) < 0.1


def test_psi_high_for_shifted_distribution():
    rng = random.Random(1)
    ref = [rng.gauss(0, 1) for _ in range(2000)]
    cur = [rng.gauss(3, 1) for _ in range(2000)]   # large mean shift
    assert population_stability_index(ref, cur) > 0.25


def test_ks_detects_shift():
    rng = random.Random(2)
    ref = [rng.gauss(0, 1) for _ in range(1000)]
    cur = [rng.gauss(2, 1) for _ in range(1000)]
    assert ks_statistic(ref, cur) > 0.3


def test_monitor_ok_when_stable():
    rng = random.Random(3)
    ref = {"snr": [rng.gauss(10, 2) for _ in range(1000)]}
    cur = {"snr": [rng.gauss(10, 2) for _ in range(1000)]}
    report = DriftMonitor(ref).check(cur)
    assert report.action in (DriftAction.OK, DriftAction.MONITOR)
    assert not report.triggered


def test_monitor_rollback_on_severe_drift():
    rng = random.Random(4)
    ref = {"snr": [rng.gauss(10, 2) for _ in range(1000)]}
    cur = {"snr": [rng.gauss(25, 2) for _ in range(1000)]}  # severe shift
    report = DriftMonitor(ref).check(cur)
    assert report.action == DriftAction.ROLLBACK
    assert report.triggered
    assert any(a.feature == "snr" for a in report.alerts)
