"""
SCRUM-66: MIMIC Phase 2 — S5 lab model reference-range calibration.
Calibrates reference ranges against real MIMIC labevents distributions
and trains a simple abnormality/risk classifier.

License: MIMIC data is ODbL — R&D only, license_cleared=False always.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score
import joblib

# ── LOINC mapping (itemid → loinc_code) ──────────────────────────────────────
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
    "50960": "2601-3",   # Magnesium
    "51006": "3094-0",   # BUN
    "50810": "20570-8",  # Hematocrit
    "51248": "785-6",    # MCH
    "51249": "786-4",    # MCHC
    "51250": "787-2",    # MCV
    "51279": "788-0",    # RBC
}

# Neuro cohort ICD codes (Alzheimer's, Parkinson's, vascular dementia)
NEURO_ICD_CODES = {
    "G30", "G300", "G301", "G308", "G309",  # Alzheimer's
    "G20",                                    # Parkinson's
    "F01", "F010", "F011", "F018", "F019",  # Vascular dementia
    "331.0", "331.9", "332.0", "290.4",      # ICD-9
}


@dataclass
class ReferenceRange:
    """Calibrated reference range from MIMIC distribution."""
    label: str
    itemid: str
    loinc_code: str
    p5: float           # 5th percentile (lower bound)
    p95: float          # 95th percentile (upper bound)
    median: float
    mean: float
    std: float
    n_samples: int
    unit: str
    license_cleared: bool = False  # MIMIC ODbL — never True


@dataclass
class AbnormalityModel:
    """Trained lab-panel abnormality/risk model metadata."""
    model_path: str
    features: list[str]
    f1_score: float
    n_train: int
    n_test: int
    license_cleared: bool = False  # MIMIC ODbL — never True

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Data loading ──────────────────────────────────────────────────────────────

def load_mimic_data(mimic_root: str | Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load labevents and d_labitems from MIMIC demo."""
    mimic_root = Path(mimic_root)

    labevents = pd.read_csv(mimic_root / "labevents.csv.gz", dtype=str)
    labevents.columns = [c.lower() for c in labevents.columns]

    d_labitems = pd.read_csv(mimic_root / "d_labitems.csv.gz", dtype=str)
    d_labitems.columns = [c.lower() for c in d_labitems.columns]

    return labevents, d_labitems


def load_diagnoses(mimic_root: str | Path) -> pd.DataFrame:
    """Load diagnoses_icd for neuro cohort filtering."""
    mimic_root = Path(mimic_root)
    df = pd.read_csv(mimic_root / "diagnoses_icd.csv.gz", dtype=str)
    df.columns = [c.lower() for c in df.columns]
    return df


# ── Reference range calibration ───────────────────────────────────────────────

def calibrate_reference_ranges(
    mimic_root: str | Path,
    target_itemids: list[str] | None = None,
) -> dict[str, ReferenceRange]:
    """
    Calibrate reference ranges from real labevents distributions.
    Replaces hard-coded cut-offs in blood_nlp_extractor.py.

    Returns dict of itemid → ReferenceRange.
    """
    labevents, d_labitems = load_mimic_data(mimic_root)

    # Numeric values only
    labevents["valuenum"] = pd.to_numeric(labevents["valuenum"], errors="coerce")
    labevents = labevents.dropna(subset=["valuenum"])

    # Filter to target analytes
    if target_itemids:
        labevents = labevents[labevents["itemid"].isin(target_itemids)]

    # Build label lookup
    label_map = d_labitems.set_index("itemid")["label"].to_dict()
    unit_map = (
        labevents.groupby("itemid")["valueuom"]
        .agg(lambda x: x.mode()[0] if len(x) > 0 else "")
        .to_dict()
    )

    ranges: dict[str, ReferenceRange] = {}

    for itemid, group in labevents.groupby("itemid"):
        vals = group["valuenum"].dropna()
        if len(vals) < 10:
            continue

        itemid_str = str(itemid)
        ranges[itemid_str] = ReferenceRange(
            label=label_map.get(itemid_str, ""),
            itemid=itemid_str,
            loinc_code=LOINC_MAP.get(itemid_str, ""),
            p5=float(np.percentile(vals, 5)),
            p95=float(np.percentile(vals, 95)),
            median=float(np.median(vals)),
            mean=float(np.mean(vals)),
            std=float(np.std(vals)),
            n_samples=len(vals),
            unit=unit_map.get(itemid_str, ""),
            license_cleared=False,
        )

    return ranges


def save_reference_ranges(ranges: dict[str, ReferenceRange], output_path: str | Path):
    """Save calibrated ranges to JSON."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = {k: asdict(v) for k, v in ranges.items()}
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved {len(ranges)} reference ranges to {output_path}")


# ── Abnormality model ─────────────────────────────────────────────────────────

def build_feature_matrix(
    labevents: pd.DataFrame,
    target_itemids: list[str],
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Build feature matrix: each row = one hospital admission,
    each column = one lab analyte (median value).
    Label = 1 if any flag='abnormal', else 0.
    """
    labevents["valuenum"] = pd.to_numeric(labevents["valuenum"], errors="coerce")
    labevents = labevents[labevents["itemid"].isin(target_itemids)]

    # Pivot: hadm_id x itemid → median value
    pivot = (
        labevents.groupby(["hadm_id", "itemid"])["valuenum"]
        .median()
        .unstack(fill_value=np.nan)
    )
    pivot.columns = [f"item_{c}" for c in pivot.columns]

    # Label: any abnormal flag in admission
    labels = (
        labevents[labevents["flag"] == "abnormal"]
        .groupby("hadm_id")["flag"]
        .count()
        .gt(0)
        .astype(int)
        .reindex(pivot.index, fill_value=0)
    )

    # Drop rows with too many NaN
    pivot = pivot.dropna(thresh=int(len(pivot.columns) * 0.5))
    labels = labels.reindex(pivot.index)

    # Fill remaining NaN with median
    pivot = pivot.fillna(pivot.median())

    return pivot, labels


def train_abnormality_model(
    mimic_root: str | Path,
    output_dir: str | Path,
    target_itemids: list[str] | None = None,
) -> AbnormalityModel:
    """
    Train lab-panel abnormality/risk model.
    Registers checkpoint with license_cleared=False.
    """
    mimic_root = Path(mimic_root)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if target_itemids is None:
        target_itemids = list(LOINC_MAP.keys())

    labevents, _ = load_mimic_data(mimic_root)
    X, y = build_feature_matrix(labevents, target_itemids)

    if len(X) < 20:
        raise ValueError(f"Not enough samples: {len(X)}. Need at least 20.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    model = GradientBoostingClassifier(n_estimators=50, max_depth=3, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    print(classification_report(y_test, y_pred, zero_division=0))
    print(f"F1 score: {f1:.3f}")

    # Save model with license_cleared=False
    model_path = output_dir / "lab_abnormality_model.joblib"
    joblib.dump({
        "model": model,
        "features": list(X.columns),
        "license_cleared": False,   # MIMIC ODbL — R&D only
        "f1_score": f1,
    }, model_path)

    return AbnormalityModel(
        model_path=str(model_path),
        features=list(X.columns),
        f1_score=f1,
        n_train=len(X_train),
        n_test=len(X_test),
        license_cleared=False,
    )


# ── Neuro cohort analysis ─────────────────────────────────────────────────────

def get_neuro_cohort_subjects(mimic_root: str | Path) -> set[str]:
    """Filter subjects with neuro diagnoses (Alzheimer's, Parkinson's, dementia)."""
    diagnoses = load_diagnoses(mimic_root)
    mask = diagnoses["icd_code"].isin(NEURO_ICD_CODES)
    return set(diagnoses[mask]["subject_id"].unique())


def analyze_neuro_lab_patterns(
    mimic_root: str | Path,
    target_itemids: list[str] | None = None,
) -> pd.DataFrame:
    """
    Compare lab/biomarker patterns between neuro and non-neuro patients.
    Returns summary DataFrame.
    """
    mimic_root = Path(mimic_root)
    labevents, d_labitems = load_mimic_data(mimic_root)
    neuro_subjects = get_neuro_cohort_subjects(mimic_root)

    labevents["valuenum"] = pd.to_numeric(labevents["valuenum"], errors="coerce")
    labevents = labevents.dropna(subset=["valuenum"])

    if target_itemids:
        labevents = labevents[labevents["itemid"].isin(target_itemids)]

    label_map = d_labitems.set_index("itemid")["label"].to_dict()
    labevents["is_neuro"] = labevents["subject_id"].isin(neuro_subjects)
    labevents["label"] = labevents["itemid"].map(label_map)

    summary = (
        labevents.groupby(["label", "is_neuro"])["valuenum"]
        .agg(["mean", "median", "std", "count"])
        .round(3)
        .reset_index()
    )
    summary["group"] = summary["is_neuro"].map({True: "neuro", False: "control"})
    summary = summary.drop(columns=["is_neuro"])

    return summary
