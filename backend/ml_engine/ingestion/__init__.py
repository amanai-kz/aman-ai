"""Compliant data ingestion (DICOM de-identification + standardisation; MIMIC EHR/vitals/ECG)."""
from .dicom import (
    IngestionManifest, deidentify, has_phi, load_series, pseudonymise, series_to_volume,
)
from .ecg import (
    EcgIngestionManifest,
    compute_hrv,
    detect_r_peaks,
    load_ecg_windows,
    normalise_windows as ecg_normalise_windows,
    pseudonymise as ecg_pseudonymise,
)
from .ehr import (
    EhrIngestionManifest,
    load_vitals_windows,
    normalise_windows as ehr_normalise_windows,
    pseudonymise as ehr_pseudonymise,
)

__all__ = [
    "IngestionManifest", "deidentify", "has_phi", "load_series",
    "pseudonymise", "series_to_volume",
    "EhrIngestionManifest", "load_vitals_windows", "ehr_normalise_windows", "ehr_pseudonymise",
    "EcgIngestionManifest", "load_ecg_windows", "ecg_normalise_windows", "ecg_pseudonymise",
    "compute_hrv", "detect_r_peaks",
]
