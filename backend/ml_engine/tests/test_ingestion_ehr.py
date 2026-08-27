"""Tests for MIMIC EHR-vitals ingestion (ml_engine.ingestion.ehr, SCRUM-65/68)."""
import pytest

pd = pytest.importorskip("pandas")

from ml_engine.ingestion.ehr import (
    VITAL_ITEMS, load_vitals_windows, normalise_windows, pseudonymise,
)


def _write_chartevents(mimic_dir, rows):
    icu = mimic_dir / "icu"
    icu.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows, columns=["subject_id", "stay_id", "itemid", "charttime", "valuenum"])
    df.to_csv(icu / "chartevents.csv.gz", index=False, compression="gzip")


def _hourly_stay_rows(subject_id, stay_id, n_hours, channels=tuple(VITAL_ITEMS), start="2026-01-01"):
    ts = pd.date_range(start, periods=n_hours, freq="1h")
    rows = []
    for hour_idx, t in enumerate(ts):
        for ch_idx, ch in enumerate(channels):
            value = 60.0 + 5.0 * ((hour_idx + ch_idx) % 4)   # deterministic, non-constant
            rows.append((subject_id, stay_id, VITAL_ITEMS[ch], t.isoformat(), value))
    return rows


def test_pseudonymise_is_deterministic_and_opaque():
    a = pseudonymise(12345)
    assert a == pseudonymise(12345)
    assert "12345" not in a and len(a) == 16


def test_load_vitals_windows_shapes_and_provenance(tmp_path):
    rows = _hourly_stay_rows(subject_id=1, stay_id=100, n_hours=30)
    _write_chartevents(tmp_path, rows)

    windows, manifests = load_vitals_windows(tmp_path, window_steps=24)

    assert windows.shape == (1, len(VITAL_ITEMS), 24)
    assert len(manifests) == 1
    m = manifests[0]
    assert m.stay_id == 100
    assert m.n_timesteps == 24
    assert m.deidentified is True
    assert m.license_cleared is False          # never cleared for MIMIC-derived data
    assert "12345" not in m.pseudo_id           # not the raw subject id, opaque hash


def test_load_vitals_windows_drops_sparse_stay(tmp_path):
    good = _hourly_stay_rows(subject_id=1, stay_id=100, n_hours=30)
    # Sparse stay: only 2 charted hours out of a 30-hour span -> below min_coverage.
    sparse_ts = list(pd.date_range("2026-01-01", periods=30, freq="1h"))
    sparse = [
        (2, 200, VITAL_ITEMS[ch], sparse_ts[i].isoformat(), 70.0)
        for i, ch in zip((0, 29), list(VITAL_ITEMS)[:2])
    ]
    _write_chartevents(tmp_path, good + sparse)

    windows, manifests = load_vitals_windows(tmp_path, window_steps=24, min_coverage=0.5)

    assert len(manifests) == 1
    assert manifests[0].stay_id == 100          # only the well-covered stay survives


def test_load_vitals_windows_raises_when_nothing_qualifies(tmp_path):
    rows = _hourly_stay_rows(subject_id=1, stay_id=100, n_hours=5)  # shorter than window_steps
    _write_chartevents(tmp_path, rows)

    with pytest.raises(ValueError):
        load_vitals_windows(tmp_path, window_steps=24)


def test_normalise_windows_zero_mean_unit_std(tmp_path):
    rows = (
        _hourly_stay_rows(subject_id=1, stay_id=100, n_hours=24)
        + _hourly_stay_rows(subject_id=2, stay_id=200, n_hours=24, start="2026-02-01")
    )
    _write_chartevents(tmp_path, rows)
    windows, _ = load_vitals_windows(tmp_path, window_steps=24)

    norm = normalise_windows(windows)
    assert norm.shape == windows.shape
    assert norm.mean(axis=(0, 2)) == pytest.approx([0.0] * len(VITAL_ITEMS), abs=1e-5)
    assert norm.std(axis=(0, 2)) == pytest.approx([1.0] * len(VITAL_ITEMS), abs=1e-4)
