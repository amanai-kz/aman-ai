"""DICOM ingestion + de-identification (data pipeline, §3.3 / §6.4).

Hospital MRI arrives as DICOM series carrying PHI. Before any study reaches the
models it must be (1) **de-identified** — identifying tags removed and the
patient id replaced by a salted pseudonym — and (2) **standardised** into a
model-ready volume. This module does both and emits a provenance manifest that
maps onto the registry's :class:`DataProvenance` (so a trained model records
exactly which data — and whether it was licence-cleared — it saw).

This is the bridge to the commercially-cleared partner dataset (decision D10):
the loaders/train loops already take a NIfTI dir; this adds the compliant
DICOM→volume front door for real hospital data. Set ``license_cleared=True``
only for data with a signed clearance.
"""
from __future__ import annotations

import glob
import hashlib
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F

# Tags that carry protected health information — blanked on ingest.
PHI_TAGS = (
    "PatientName", "PatientID", "PatientBirthDate", "PatientAddress",
    "PatientTelephoneNumbers", "OtherPatientIDs", "OtherPatientNames",
    "ReferringPhysicianName", "PerformingPhysicianName", "OperatorsName",
    "InstitutionName", "InstitutionAddress", "StationName",
    "AccessionNumber", "StudyID", "DeviceSerialNumber",
)


@dataclass
class IngestionManifest:
    """Provenance for one ingested study (feeds registry DataProvenance)."""

    pseudo_id: str                       # salted hash of the original PatientID
    sequence: str = ""                   # T1 / T2 / FLAIR / SWI (best-effort)
    modality: str = ""
    n_slices: int = 0
    spacing: tuple[float, float, float] = (0.0, 0.0, 0.0)
    deidentified: bool = True
    license_cleared: bool = False        # set True ONLY for signed-clearance data
    source: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def pseudonymise(patient_id: str, salt: str = "aman") -> str:
    return hashlib.sha256(f"{salt}:{patient_id}".encode()).hexdigest()[:16]


def deidentify(ds, salt: str = "aman") -> str:
    """Blank PHI tags in-place; return the pseudonymous id. ``ds`` is a pydicom Dataset."""
    original = str(getattr(ds, "PatientID", "") or "")
    pseudo = pseudonymise(original, salt)
    for tag in PHI_TAGS:
        if tag in ds:
            ds.data_element(tag).value = ""
    ds.PatientID = pseudo
    ds.PatientIdentityRemoved = "YES"
    ds.DeidentificationMethod = "aman-ml PHI tag removal + pseudonymisation"
    return pseudo


def has_phi(ds) -> bool:
    """True if any PHI tag still carries a value (post-deid verification)."""
    return any(tag in ds and str(ds.data_element(tag).value) not in ("", "None")
               for tag in PHI_TAGS if tag != "PatientID")


def load_series(dicom_dir: str | Path, *, salt: str = "aman", deid: bool = True):
    """Load + (optionally) de-identify a DICOM series -> (volume D,H,W, manifest)."""
    import pydicom  # lazy
    paths = sorted(glob.glob(os.path.join(str(dicom_dir), "**", "*.dcm"), recursive=True)) \
        or sorted(glob.glob(os.path.join(str(dicom_dir), "*")))
    slices = []
    for p in paths:
        try:
            slices.append(pydicom.dcmread(p))
        except Exception:
            continue
    if not slices:
        raise FileNotFoundError(f"no readable DICOM under {dicom_dir}")
    # order by spatial position when available, else InstanceNumber
    def _key(s):
        ipp = getattr(s, "ImagePositionPatient", None)
        return float(ipp[2]) if ipp else float(getattr(s, "InstanceNumber", 0) or 0)
    slices.sort(key=_key)

    pseudo = ""
    for s in slices:
        pid = deidentify(s, salt) if deid else pseudonymise(str(getattr(s, "PatientID", "")), salt)
        pseudo = pid

    vol = torch.stack([torch.as_tensor(s.pixel_array, dtype=torch.float32) for s in slices])
    px = getattr(slices[0], "PixelSpacing", [1.0, 1.0])
    thick = float(getattr(slices[0], "SliceThickness", 1.0) or 1.0)
    manifest = IngestionManifest(
        pseudo_id=pseudo,
        sequence=str(getattr(slices[0], "SeriesDescription", "") or ""),
        modality=str(getattr(slices[0], "Modality", "") or ""),
        n_slices=len(slices),
        spacing=(thick, float(px[0]), float(px[1])),
        deidentified=deid,
        source=str(dicom_dir),
    )
    return vol, manifest


def series_to_volume(dicom_dir: str | Path, img_size=(128, 128, 128),
                     in_channels: int = 1, *, deid: bool = True):
    """DICOM series -> standardised ``(C, D, H, W)`` tensor + manifest."""
    vol, manifest = load_series(dicom_dir, deid=deid)
    vol = F.interpolate(vol[None, None], size=tuple(img_size), mode="trilinear",
                        align_corners=False)[0]
    if in_channels > 1:
        vol = vol.expand(in_channels, *tuple(img_size)).contiguous()
    vol = (vol - vol.mean()) / (vol.std() + 1e-6)
    return vol, manifest
