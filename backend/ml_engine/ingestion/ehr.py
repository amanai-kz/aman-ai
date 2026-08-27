"""EHR-vitals ingestion for MIMIC-derived S2 biosignal pretraining (SCRUM-65/68).

Mirrors :mod:`ml_engine.ingestion.dicom`'s contract (manifest + hard-coded
``license_cleared=False``) for a different source modality, per
``docs/mimic-data-strategy.md`` §4: "New ingestion adapter alongside the DICOM
one ... emits the same ``IngestionManifest``/``DataProvenance`` shape".

Honesty note (read before wiring this into anything downstream): the **MIMIC-IV
Clinical Database Demo** (ODbL, no DUA — the only MIMIC tier downloaded so far,
see the SCRUM-64 provenance note) carries only intermittently *charted* ICU
vitals in ``icu/chartevents`` — heart rate, respiratory rate, SpO2, and
non-invasive blood pressure sampled roughly hourly by nursing staff. It does
**not** contain continuous PPG/ECG waveforms. True beat-to-beat HRV (SDNN,
RMSSD) requires the separate, fully-*credentialed* MIMIC Waveform Database /
MIMIC-IV-ECG corpora (CITI + signed DUA, per Phase 4 in the data strategy) —
out of scope until that access is acquired. What this module actually produces
is hourly-resampled multichannel vitals windows: a legitimate S2-*adjacent*
pretraining signal (see data-strategy.md §3, "vitals (S2-adjacent)"), not HRV
in the strict sense. Never promote a model trained on this to production
(``license_cleared`` stays ``False``; D10/D11).
"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# MIMIC-IV icu.d_items itemids for routine ICU vitals — verified against the
# v2.2 Clinical Database Demo's icu/d_items.csv.gz (category "Routine Vital
# Signs" / "Respiratory").
VITAL_ITEMS: dict[str, int] = {
    "heart_rate": 220045,
    "resp_rate": 220210,
    "spo2": 220277,
    "nibp_systolic": 220179,
    "nibp_diastolic": 220180,
}


@dataclass
class EhrIngestionManifest:
    """Provenance for one ingested ICU stay (feeds registry ``DataProvenance``).

    Field-for-field analogue of
    :class:`ml_engine.ingestion.dicom.IngestionManifest` so EHR-derived and
    DICOM-derived data both plug into the same registry shape.
    """

    pseudo_id: str                        # salted hash of subject_id
    stay_id: int = 0
    channels: tuple[str, ...] = ()
    n_timesteps: int = 0
    resample_freq: str = "1h"
    deidentified: bool = True             # MIMIC ships pre-deidentified
    license_cleared: bool = False         # never True for MIMIC-derived data
    source: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def pseudonymise(subject_id: Any, salt: str = "aman-ehr") -> str:
    return hashlib.sha256(f"{salt}:{subject_id}".encode()).hexdigest()[:16]


def load_vitals_windows(
    mimic_dir: str | Path,
    *,
    channels: tuple[str, ...] = tuple(VITAL_ITEMS),
    resample_freq: str = "1h",
    window_steps: int = 24,
    min_coverage: float = 0.5,
    max_stays: int | None = None,
) -> tuple[np.ndarray, list[EhrIngestionManifest]]:
    """MIMIC ICU ``chartevents`` -> fixed-length vitals windows + manifests.

    For each ICU stay: pivot the requested channels onto a regular
    ``resample_freq`` grid (mean per bin), keep stays where the pre-interpolation
    bin coverage is at least ``min_coverage``, gap-fill by interpolation, then
    take the first ``window_steps`` bins. Stays with any channel entirely
    missing, or shorter than ``window_steps``, are dropped.

    Returns ``(windows, manifests)``: ``windows`` is
    ``(N, len(channels), window_steps)`` float32 (un-normalised — see
    :func:`normalise_windows`); ``manifests[i]`` describes ``windows[i]``.
    """
    mimic_dir = Path(mimic_dir)
    icu = mimic_dir / "icu"
    itemids = [VITAL_ITEMS[c] for c in channels]

    ce = pd.read_csv(
        icu / "chartevents.csv.gz", compression="gzip",
        usecols=["subject_id", "stay_id", "itemid", "charttime", "valuenum"],
    )
    ce = ce[ce["itemid"].isin(itemids)].copy()
    ce["charttime"] = pd.to_datetime(ce["charttime"])
    item_to_channel = {v: k for k, v in VITAL_ITEMS.items()}
    ce["channel"] = ce["itemid"].map(item_to_channel)

    windows: list[np.ndarray] = []
    manifests: list[EhrIngestionManifest] = []
    stay_ids = sorted(ce["stay_id"].dropna().unique())
    if max_stays:
        stay_ids = stay_ids[:max_stays]

    for stay_id in stay_ids:
        stay = ce[ce["stay_id"] == stay_id]
        subject_id = int(stay["subject_id"].iloc[0])
        pivot = (
            stay.pivot_table(index="charttime", columns="channel", values="valuenum", aggfunc="mean")
            .reindex(columns=channels)
        )
        if pivot.empty:
            continue
        grid = pivot.resample(resample_freq).mean()
        coverage = float(grid.notna().mean().mean())
        if coverage < min_coverage or len(grid) < window_steps:
            continue
        grid = grid.interpolate(limit_direction="both")
        if grid.isna().any().any():
            continue  # a channel had zero readings for this stay -> can't fill
        arr = grid.iloc[:window_steps].to_numpy(dtype="float32").T  # (C, T)
        windows.append(arr)
        manifests.append(EhrIngestionManifest(
            pseudo_id=pseudonymise(subject_id),
            stay_id=int(stay_id),
            channels=tuple(channels),
            n_timesteps=arr.shape[1],
            resample_freq=resample_freq,
            source=f"mimic-iv-demo:{mimic_dir.name}",
        ))

    if not windows:
        raise ValueError(f"no ICU stays met coverage>={min_coverage} under {mimic_dir}")
    return np.stack(windows), manifests


def normalise_windows(windows: np.ndarray) -> np.ndarray:
    """Per-channel z-score fit across the whole loaded cohort, applied to all."""
    mu = windows.mean(axis=(0, 2), keepdims=True)
    sigma = windows.std(axis=(0, 2), keepdims=True) + 1e-6
    return ((windows - mu) / sigma).astype("float32")
