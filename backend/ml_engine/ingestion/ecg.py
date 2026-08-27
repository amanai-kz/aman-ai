"""MIMIC-IV-ECG ingestion + real HRV feature extraction (SCRUM-68, S2).

Closes a gap flagged in :mod:`ml_engine.ingestion.ehr`'s docstring: that module
ingests only intermittently *charted* ICU vitals (no continuous waveform).
This module reads the actual **MIMIC-IV-ECG Demo** —
https://physionet.org/content/mimic-iv-ecg-demo/0.1/ — an ODbL, no-DUA open
subset (verified: PhysioNet page confirms "Open Data Commons Open Database
License v1.0"; no credentialing required). It contains 659 twelve-lead,
500 Hz, 10-second diagnostic ECGs across 92 patients overlapping the MIMIC-IV
Clinical Database Demo cohort — genuine continuous waveform data, so real
(if short-window) R-peak-derived HRV (SDNN, RMSSD) is possible, unlike the
vitals proxy in ``ingestion.ehr``.

Scope honesty: this is still a *demo* subset (92 patients, single 10 s strip
each) of the forthcoming full, **credentialed** MIMIC-IV-ECG module — fine for
R&D pretraining and an honest small-sample HRV sanity check, not a clinical
HRV study. ``license_cleared`` stays ``False`` for anything trained on it
(D10/D11, ``docs/mimic-data-strategy.md``).
"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np


@dataclass
class EcgIngestionManifest:
    """Provenance for one ingested ECG record (feeds registry ``DataProvenance``).

    Field-for-field analogue of
    :class:`ml_engine.ingestion.dicom.IngestionManifest` /
    :class:`ml_engine.ingestion.ehr.EhrIngestionManifest`.
    """

    pseudo_id: str                        # salted hash of the MIMIC subject_id
    record_id: str = ""
    leads: tuple[str, ...] = ()
    fs: float = 0.0
    n_samples: int = 0
    hrv_sdnn_ms: float = float("nan")     # real R-peak-derived HRV (single 10s strip)
    hrv_rmssd_ms: float = float("nan")
    mean_hr_bpm: float = float("nan")
    deidentified: bool = True             # MIMIC ships pre-deidentified
    license_cleared: bool = False         # never True for MIMIC-derived data
    source: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def pseudonymise(subject_id: Any, salt: str = "aman-ecg") -> str:
    return hashlib.sha256(f"{salt}:{subject_id}".encode()).hexdigest()[:16]


def detect_r_peaks(ecg_lead: np.ndarray, fs: float) -> np.ndarray:
    """Lightweight Pan-Tompkins-style QRS detector (bandpass + derivative +
    moving-window integration + peak-picking).

    Not a clinical-grade detector — good enough to derive an honest,
    order-of-magnitude HRV estimate from a single ~10 s strip; a real product
    HRV feature would use a validated detector (e.g. ``neurokit2``) and
    multi-minute recordings.
    """
    from scipy.signal import butter, filtfilt, find_peaks

    nyq = fs / 2.0
    b, a = butter(3, [5 / nyq, 15 / nyq], btype="band")
    filtered = filtfilt(b, a, ecg_lead)
    derivative = np.diff(filtered, prepend=filtered[0])
    squared = derivative ** 2
    window = max(1, int(0.15 * fs))
    integrated = np.convolve(squared, np.ones(window) / window, mode="same")

    min_distance = max(1, int(0.3 * fs))    # refractory period, caps ~200 bpm
    peak_height = 0.35 * integrated.max() if integrated.max() > 0 else 0.0
    peaks, _ = find_peaks(integrated, height=peak_height, distance=min_distance)
    return peaks


def compute_hrv(r_peaks: np.ndarray, fs: float) -> dict[str, float]:
    """SDNN / RMSSD (ms) + mean heart rate (bpm) from R-peak sample indices."""
    if len(r_peaks) < 3:
        return {"sdnn_ms": float("nan"), "rmssd_ms": float("nan"), "mean_hr_bpm": float("nan")}
    rr_ms = np.diff(r_peaks) / fs * 1000.0
    return {
        "sdnn_ms": float(np.std(rr_ms, ddof=1)),
        "rmssd_ms": float(np.sqrt(np.mean(np.diff(rr_ms) ** 2))),
        "mean_hr_bpm": float(60000.0 / np.mean(rr_ms)),
    }


def _find_lead_index(sig_names: list[str], preferred: tuple[str, ...]) -> int:
    for name in preferred:
        if name in sig_names:
            return sig_names.index(name)
    return 0


def load_ecg_windows(
    ecg_dir: str | Path,
    *,
    max_records: int | None = None,
    hrv_lead_preference: tuple[str, ...] = ("II", "V5", "I"),
) -> tuple[np.ndarray, list[EcgIngestionManifest]]:
    """MIMIC-IV-ECG demo WFDB records -> ``(N, n_leads, n_samples)`` waveforms + manifests.

    Every demo record is a fixed 12-lead, 500 Hz, 10 s strip, so no
    resampling is needed (unlike the variable-length ICU vitals in
    ``ingestion.ehr``); records are truncated to the shortest length present
    before stacking, as a defensive measure. R-peaks are detected on one
    clinically-standard lead per record (limb lead II preferred) to attach
    real HRV features to the manifest — informational provenance, not an SSL
    target.
    """
    import wfdb

    ecg_dir = Path(ecg_dir)
    records_file = ecg_dir / "RECORDS"
    rel_paths = [line.strip() for line in records_file.read_text().splitlines() if line.strip()]
    if max_records:
        rel_paths = rel_paths[:max_records]

    windows: list[np.ndarray] = []
    manifests: list[EcgIngestionManifest] = []
    for rel in rel_paths:
        record = wfdb.rdrecord(str(ecg_dir / rel))
        sig = np.nan_to_num(record.p_signal.T, nan=0.0).astype("float32")  # (n_leads, n_samples)

        lead_idx = _find_lead_index(record.sig_name, hrv_lead_preference)
        peaks = detect_r_peaks(sig[lead_idx], record.fs)
        hrv = compute_hrv(peaks, record.fs)

        # rel looks like "files/p10000032/s100780919/100780919"
        subject_dir = Path(rel).parts[1] if len(Path(rel).parts) > 1 else ""
        subject_id = subject_dir.lstrip("p")

        manifests.append(EcgIngestionManifest(
            pseudo_id=pseudonymise(subject_id),
            record_id=Path(rel).name,
            leads=tuple(record.sig_name),
            fs=float(record.fs),
            n_samples=sig.shape[1],
            hrv_sdnn_ms=hrv["sdnn_ms"],
            hrv_rmssd_ms=hrv["rmssd_ms"],
            mean_hr_bpm=hrv["mean_hr_bpm"],
            source=f"mimic-iv-ecg-demo:{ecg_dir.name}",
        ))
        windows.append(sig)

    if not windows:
        raise ValueError(f"no ECG records found under {ecg_dir}")
    min_len = min(w.shape[1] for w in windows)
    stacked = np.stack([w[:, :min_len] for w in windows])
    return stacked, manifests


def normalise_windows(windows: np.ndarray) -> np.ndarray:
    """Per-lead z-score fit across the whole loaded cohort, applied to all."""
    mu = windows.mean(axis=(0, 2), keepdims=True)
    sigma = windows.std(axis=(0, 2), keepdims=True) + 1e-6
    return ((windows - mu) / sigma).astype("float32")
