"""Tests for MIMIC-IV-ECG ingestion + HRV extraction (ml_engine.ingestion.ecg, SCRUM-68)."""
import numpy as np
import pytest

wfdb = pytest.importorskip("wfdb")
pytest.importorskip("scipy")

from ml_engine.ingestion.ecg import (
    compute_hrv, detect_r_peaks, load_ecg_windows, normalise_windows, pseudonymise,
)


def test_pseudonymise_is_deterministic_and_opaque():
    a = pseudonymise("10000032")
    assert a == pseudonymise("10000032")
    assert "10000032" not in a and len(a) == 16


def _synthetic_ecg_lead(fs=500, duration_s=10.0, hr_bpm=60.0, jitter=0.0, seed=0):
    """A crude periodic-spike ECG stand-in with a known, controllable heart rate."""
    rng = np.random.default_rng(seed)
    n = int(fs * duration_s)
    t = np.arange(n) / fs
    signal = np.zeros(n)
    rr_s = 60.0 / hr_bpm
    beat_time = rr_s
    while beat_time < duration_s:
        jittered = beat_time + rng.normal(0, jitter)
        idx = int(jittered * fs)
        if 0 <= idx < n:
            width = max(1, int(0.02 * fs))
            lo, hi = max(0, idx - width), min(n, idx + width)
            signal[lo:hi] += np.hanning(hi - lo) * 5.0
        beat_time += rr_s
    signal += 0.01 * rng.standard_normal(n)   # tiny sensor noise
    return signal.astype("float32"), t


def test_detect_r_peaks_recovers_known_heart_rate():
    fs = 500
    lead, _ = _synthetic_ecg_lead(fs=fs, hr_bpm=75.0, jitter=0.0)
    peaks = detect_r_peaks(lead, fs)
    hrv = compute_hrv(peaks, fs)
    assert hrv["mean_hr_bpm"] == pytest.approx(75.0, abs=3.0)
    assert hrv["sdnn_ms"] < 15.0   # near-perfectly regular beats -> low SDNN


def test_compute_hrv_nan_below_three_peaks():
    hrv = compute_hrv(np.array([0, 100]), fs=500.0)
    assert all(v != v for v in hrv.values())  # all NaN


def _write_demo_record(write_dir, record_name, n_leads=12, fs=500, seed=0):
    rng = np.random.default_rng(seed)
    duration_s = 10.0
    leads = [f"L{i}" for i in range(n_leads)]
    sig = np.stack([
        _synthetic_ecg_lead(fs=fs, duration_s=duration_s, hr_bpm=70.0 + i, seed=seed + i)[0]
        for i in range(n_leads)
    ], axis=1)  # (n_samples, n_leads)
    wfdb.wrsamp(
        record_name, fs=fs, units=["mV"] * n_leads, sig_name=leads,
        p_signal=sig.astype("float64"), fmt=["16"] * n_leads, write_dir=str(write_dir),
    )


def test_load_ecg_windows_shapes_and_provenance(tmp_path):
    files = tmp_path / "files" / "p10000032" / "s100780919"
    files.mkdir(parents=True)
    _write_demo_record(files, "100780919", n_leads=12, fs=500, seed=0)
    (tmp_path / "RECORDS").write_text("files/p10000032/s100780919/100780919\n")

    windows, manifests = load_ecg_windows(tmp_path)

    assert windows.shape == (1, 12, 5000)
    assert len(manifests) == 1
    m = manifests[0]
    assert m.record_id == "100780919"
    assert m.n_samples == 5000
    assert m.fs == 500.0
    assert m.deidentified is True
    assert m.license_cleared is False
    assert "10000032" not in m.pseudo_id
    assert m.hrv_sdnn_ms == m.hrv_sdnn_ms  # not NaN -- R-peaks were found


def test_load_ecg_windows_raises_when_empty(tmp_path):
    (tmp_path / "RECORDS").write_text("")
    with pytest.raises(ValueError):
        load_ecg_windows(tmp_path)


def test_normalise_windows_zero_mean_unit_std(tmp_path):
    for i, (subj, stay) in enumerate([("p1", "s1"), ("p2", "s2")]):
        files = tmp_path / "files" / subj / stay
        files.mkdir(parents=True)
        _write_demo_record(files, f"rec{i}", n_leads=3, fs=500, seed=i)
    (tmp_path / "RECORDS").write_text(
        "files/p1/s1/rec0\nfiles/p2/s2/rec1\n"
    )
    windows, _ = load_ecg_windows(tmp_path)
    norm = normalise_windows(windows)
    assert norm.mean(axis=(0, 2)) == pytest.approx([0.0] * 3, abs=1e-4)
    assert norm.std(axis=(0, 2)) == pytest.approx([1.0] * 3, abs=1e-3)
