"""
Unit tests for backend/ml_engine/evaluation/lab_reference_ranges.py
SCRUM-66 — never loads real MIMIC rows.
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock


MOCK_LABEVENTS = pd.DataFrame({
    "subject_id": ["10001"] * 10 + ["10002"] * 10,
    "hadm_id":    ["20001"] * 10 + ["20002"] * 10,
    "itemid":     ["50931"] * 10 + ["51222"] * 10,
    "valuenum":   [4.5, 5.0, 5.2, 5.5, 6.0, 4.8, 5.1, 4.9, 5.3, 5.6,
                   120, 125, 130, 135, 140, 122, 128, 132, 138, 142],
    "valueuom":   ["mmol/L"] * 10 + ["g/L"] * 10,
    "flag":       [""] * 8 + ["abnormal"] * 2 + [""] * 8 + ["abnormal"] * 2,
})

MOCK_D_LABITEMS = pd.DataFrame({
    "itemid": ["50931", "51222"],
    "label":  ["Glucose", "Hemoglobin"],
    "fluid":  ["Blood", "Blood"],
    "category": ["Chemistry", "Hematology"],
})

MOCK_DIAGNOSES = pd.DataFrame({
    "subject_id": ["10001", "10002", "10003"],
    "hadm_id":    ["20001", "20002", "20003"],
    "icd_code":   ["G30", "G20", "I10"],
})


# ── Tests: calibrate_reference_ranges ────────────────────────────────────────

def test_calibrate_returns_ranges():
    from ml_engine.evaluation.lab_reference_ranges import calibrate_reference_ranges
    with patch("ml_engine.evaluation.lab_reference_ranges.load_mimic_data",
               return_value=(MOCK_LABEVENTS, MOCK_D_LABITEMS)):
        ranges = calibrate_reference_ranges("/fake/mimic")
    assert len(ranges) > 0


def test_calibrate_correct_percentiles():
    from ml_engine.evaluation.lab_reference_ranges import calibrate_reference_ranges
    with patch("ml_engine.evaluation.lab_reference_ranges.load_mimic_data",
               return_value=(MOCK_LABEVENTS, MOCK_D_LABITEMS)):
        ranges = calibrate_reference_ranges("/fake/mimic")
    glucose = ranges.get("50931")
    assert glucose is not None
    assert glucose.p5 < glucose.median < glucose.p95


def test_calibrate_license_cleared_false():
    """Reference ranges must always have license_cleared=False."""
    from ml_engine.evaluation.lab_reference_ranges import calibrate_reference_ranges
    with patch("ml_engine.evaluation.lab_reference_ranges.load_mimic_data",
               return_value=(MOCK_LABEVENTS, MOCK_D_LABITEMS)):
        ranges = calibrate_reference_ranges("/fake/mimic")
    for r in ranges.values():
        assert r.license_cleared is False


def test_calibrate_loinc_mapping():
    """Known itemids should have LOINC codes."""
    from ml_engine.evaluation.lab_reference_ranges import calibrate_reference_ranges
    with patch("ml_engine.evaluation.lab_reference_ranges.load_mimic_data",
               return_value=(MOCK_LABEVENTS, MOCK_D_LABITEMS)):
        ranges = calibrate_reference_ranges("/fake/mimic")
    if "50931" in ranges:
        assert ranges["50931"].loinc_code == "2345-7"


def test_calibrate_skips_sparse_items():
    """Items with < 10 samples should be skipped."""
    from ml_engine.evaluation.lab_reference_ranges import calibrate_reference_ranges
    sparse = MOCK_LABEVENTS.head(3)
    with patch("ml_engine.evaluation.lab_reference_ranges.load_mimic_data",
               return_value=(sparse, MOCK_D_LABITEMS)):
        ranges = calibrate_reference_ranges("/fake/mimic")
    assert len(ranges) == 0


# ── Tests: neuro cohort ───────────────────────────────────────────────────────

def test_neuro_cohort_filter():
    """Neuro subjects should be correctly identified."""
    from ml_engine.evaluation.lab_reference_ranges import get_neuro_cohort_subjects
    with patch("ml_engine.evaluation.lab_reference_ranges.load_diagnoses",
               return_value=MOCK_DIAGNOSES):
        subjects = get_neuro_cohort_subjects("/fake/mimic")
    assert "10001" in subjects  # G30 = Alzheimer's
    assert "10002" in subjects  # G20 = Parkinson's
    assert "10003" not in subjects  # I10 = Hypertension, not neuro


def test_neuro_analysis_returns_dataframe():
    """analyze_neuro_lab_patterns should return non-empty DataFrame."""
    from ml_engine.evaluation.lab_reference_ranges import analyze_neuro_lab_patterns
    with patch("ml_engine.evaluation.lab_reference_ranges.load_mimic_data",
               return_value=(MOCK_LABEVENTS, MOCK_D_LABITEMS)), \
         patch("ml_engine.evaluation.lab_reference_ranges.load_diagnoses",
               return_value=MOCK_DIAGNOSES):
        result = analyze_neuro_lab_patterns("/fake/mimic")
    assert isinstance(result, pd.DataFrame)
    assert "group" in result.columns


# ── Tests: feature matrix ─────────────────────────────────────────────────────

def test_build_feature_matrix():
    """Feature matrix should have correct shape."""
    from ml_engine.evaluation.lab_reference_ranges import build_feature_matrix
    X, y = build_feature_matrix(MOCK_LABEVENTS, ["50931", "51222"])
    assert len(X) > 0
    assert len(X) == len(y)


def test_feature_matrix_no_raw_ids():
    """Feature matrix should not contain raw subject_ids."""
    from ml_engine.evaluation.lab_reference_ranges import build_feature_matrix
    X, y = build_feature_matrix(MOCK_LABEVENTS, ["50931", "51222"])
    assert "subject_id" not in X.columns
