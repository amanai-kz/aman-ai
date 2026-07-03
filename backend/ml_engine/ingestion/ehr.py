"""
MIMIC-IV EHR ingestion adapter.
Reads demo CSVs (hosp/labevents.csv, hosp/d_labitems.csv) and emits
the same IngestionManifest / DataProvenance shape as dicom.py.

License: MIMIC data is ODbL — R&D only, license_cleared=False always.
Never load real MIMIC rows into the repo.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

# ── LOINC unit harmonisation (US mg/dL ↔ SI mmol/L) ────────────────────────
# Conversion factors: mmol/L = mg/dL * factor
UNIT_CONVERSION: dict[str, tuple[str, float]] = {
    "mg/dL":   ("mmol/L", 0.05551),   # glucose
    "mg/dl":   ("mmol/L", 0.05551),
    "mg/dL ":  ("mmol/L", 0.05551),
    "g/dL":    ("g/L",    10.0),       # hemoglobin
    "g/dl":    ("g/L",    10.0),
}

# LOINC codes for common lab analytes (from d_labitems.loinc_code)
LOINC_MAP: dict[str, str] = {
    "50931": "2345-7",   # Glucose
    "50912": "2160-0",   # Creatinine
    "50882": "1742-6",   # ALT
    "50878": "1920-8",   # AST
    "51222": "718-7",    # Hemoglobin
    "51265": "777-3",    # Platelets
    "51301": "6690-2",   # WBC
    "50893": "17861-6",  # Calcium
    "50902": "2075-0",   # Chloride
    "50971": "2823-3",   # Potassium
    "50983": "2951-2",   # Sodium
    "50885": "1975-2",   # Bilirubin Total
    "50910": "2324-2",   # GGT
    "50960": "2601-3",   # Magnesium
    "51006": "3094-0",   # Urea Nitrogen (BUN)
}


@dataclass
class LabRow:
    """One lab measurement, harmonised to SI units."""
    subject_id: str
    hadm_id: str
    itemid: str
    label: str
    loinc_code: str
    value: float | None
    value_uom: str          # original unit
    value_si: float | None  # converted to SI
    uom_si: str             # SI unit
    flag: str               # abnormal / normal / ""
    deidentified: bool = True
    license_cleared: bool = False  # MIMIC is ODbL — never True in production

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class IngestionManifest:
    """Provenance for one ingested EHR batch (mirrors dicom.py shape)."""
    pseudo_id: str
    source: str = ""
    n_rows: int = 0
    n_subjects: int = 0
    deidentified: bool = True
    license_cleared: bool = False   # MIMIC ODbL — R&D only
    analytes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Pseudonymisation ─────────────────────────────────────────────────────────

def pseudonymise(subject_id: str | int, salt: str = "aman") -> str:
    """Salted SHA-256 hash of subject_id → 16-char hex (mirrors dicom.py)."""
    return hashlib.sha256(f"{salt}:{subject_id}".encode()).hexdigest()[:16]


# ── Unit harmonisation ────────────────────────────────────────────────────────

def harmonise_unit(value: float | None, uom: str) -> tuple[float | None, str]:
    """Convert value to SI unit if conversion is known."""
    if value is None:
        return None, uom
    uom = (uom or "").strip()
    if uom in UNIT_CONVERSION:
        target_uom, factor = UNIT_CONVERSION[uom]
        return round(value * factor, 4), target_uom
    return value, uom


# ── CSV readers ───────────────────────────────────────────────────────────────

def load_d_labitems(mimic_root: str | Path) -> pd.DataFrame:
    """Load hosp/d_labitems.csv → item metadata (label, loinc_code, …)."""
    path = Path(mimic_root) / "hosp" / "d_labitems.csv"
    df = pd.read_csv(path, dtype=str)
    df.columns = [c.lower() for c in df.columns]
    return df.set_index("itemid")


def load_labevents(
    mimic_root: str | Path,
    subject_ids: list[str] | None = None,
    max_rows: int = 50_000,
) -> pd.DataFrame:
    """
    Load hosp/labevents.csv → raw lab measurements.
    Optionally filter to a subset of subject_ids.
    Never loads real PHI — demo only.
    """
    path = Path(mimic_root) / "hosp" / "labevents.csv"
    df = pd.read_csv(path, dtype=str, nrows=max_rows)
    df.columns = [c.lower() for c in df.columns]
    if subject_ids:
        df = df[df["subject_id"].isin(subject_ids)]
    return df


# ── Main ingestion function ───────────────────────────────────────────────────

def ingest_ehr(
    mimic_root: str | Path,
    *,
    salt: str = "aman",
    max_rows: int = 50_000,
) -> tuple[list[LabRow], IngestionManifest]:
    """
    Main entry point: MIMIC demo CSVs → (lab_rows, manifest).

    Args:
        mimic_root: Path to extracted MIMIC-IV demo folder
        salt: Pseudonymisation salt
        max_rows: Safety cap on rows read from labevents.csv

    Returns:
        Tuple of (list[LabRow], IngestionManifest)
    """
    mimic_root = Path(mimic_root)
    d_items = load_d_labitems(mimic_root)
    events = load_labevents(mimic_root, max_rows=max_rows)

    rows: list[LabRow] = []
    analytes: set[str] = set()

    for _, ev in events.iterrows():
        itemid = str(ev.get("itemid", ""))
        meta = d_items.loc[itemid] if itemid in d_items.index else None

        label = str(meta["label"]) if meta is not None and "label" in meta else ""
        loinc = LOINC_MAP.get(itemid, str(meta["loinc_code"]) if meta is not None and "loinc_code" in meta else "")

        try:
            raw_value = float(str(ev.get("value", "")).replace(",", "."))
        except (ValueError, TypeError):
            raw_value = None

        uom = str(ev.get("valueuom", "") or "")
        value_si, uom_si = harmonise_unit(raw_value, uom)

        pseudo = pseudonymise(ev.get("subject_id", ""), salt)

        row = LabRow(
            subject_id=pseudo,
            hadm_id=str(ev.get("hadm_id", "")),
            itemid=itemid,
            label=label,
            loinc_code=loinc,
            value=raw_value,
            value_uom=uom,
            value_si=value_si,
            uom_si=uom_si,
            flag=str(ev.get("flag", "") or ""),
            deidentified=True,
            license_cleared=False,
        )
        rows.append(row)
        if label:
            analytes.add(label)

    subjects = {r.subject_id for r in rows}
    manifest = IngestionManifest(
        pseudo_id=pseudonymise("batch", salt),
        source=str(mimic_root),
        n_rows=len(rows),
        n_subjects=len(subjects),
        deidentified=True,
        license_cleared=False,
        analytes=sorted(analytes),
    )

    return rows, manifest


# ── Iterator for large datasets ───────────────────────────────────────────────

def iter_ehr_batches(
    mimic_root: str | Path,
    batch_size: int = 1000,
    salt: str = "aman",
) -> Iterator[tuple[list[LabRow], IngestionManifest]]:
    """
    Yield batches of LabRows for memory-efficient processing.
    Keeps a clean interface for a later BigQuery source.
    """
    mimic_root = Path(mimic_root)
    d_items = load_d_labitems(mimic_root)
    path = Path(mimic_root) / "hosp" / "labevents.csv"

    for chunk in pd.read_csv(path, dtype=str, chunksize=batch_size):
        chunk.columns = [c.lower() for c in chunk.columns]
        rows: list[LabRow] = []
        analytes: set[str] = set()

        for _, ev in chunk.iterrows():
            itemid = str(ev.get("itemid", ""))
            meta = d_items.loc[itemid] if itemid in d_items.index else None
            label = str(meta["label"]) if meta is not None and "label" in meta else ""
            loinc = LOINC_MAP.get(itemid, "")

            try:
                raw_value = float(str(ev.get("value", "")).replace(",", "."))
            except (ValueError, TypeError):
                raw_value = None

            uom = str(ev.get("valueuom", "") or "")
            value_si, uom_si = harmonise_unit(raw_value, uom)

            rows.append(LabRow(
                subject_id=pseudonymise(ev.get("subject_id", ""), salt),
                hadm_id=str(ev.get("hadm_id", "")),
                itemid=itemid,
                label=label,
                loinc_code=loinc,
                value=raw_value,
                value_uom=uom,
                value_si=value_si,
                uom_si=uom_si,
                flag=str(ev.get("flag", "") or ""),
                deidentified=True,
                license_cleared=False,
            ))
            if label:
                analytes.add(label)

        manifest = IngestionManifest(
            pseudo_id=pseudonymise("batch", salt),
            source=str(mimic_root),
            n_rows=len(rows),
            n_subjects=len({r.subject_id for r in rows}),
            deidentified=True,
            license_cleared=False,
            analytes=sorted(analytes),
        )
        yield rows, manifest
