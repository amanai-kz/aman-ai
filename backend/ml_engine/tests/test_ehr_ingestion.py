"""
Unit tests for backend/ml_engine/ingestion/ehr.py
SCRUM-65 — never loads real MIMIC rows.
"""

import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from pathlib import Path


# ── Fixtures ──────────────────────────────────────────────────────────────────

MOCK_D_LABITEMS = pd.DataFrame({
    "itemid": ["50931", "50912", "51222"],
    "label":  ["Glucose", "Creatinine", "Hemoglobin"],
    "loinc_code": ["2345-7", "2160-0", "718-7"],
    "fluid": ["Blood", "Blood", "Blood"],
    "category": ["Chemistry", "Chemistry", "Hematology"],
}).set_index("itemid")

MOCK_LABEVENTS = pd.DataFrame({
    "subject_id": ["10001", "10001", "10002"],
    "hadm_id":    ["20001", "20001", "20002"],
    "itemid":     ["50931", "51222", "50912"],
    "value":      ["5.2",   "132",   "1.1"],
    "valueuom":   ["mmol/L", "g/L",  "mg/dL"],
    "flag":       ["",       "",      "abnormal"],
})


# ── Tests: pseudonymise ───────────────────────────────────────────────────────

def test_pseudonymise_returns_16_chars():
    from ml_engine.ingestion.ehr import pseudonymise
    result = pseudonymise("10001")
    assert len(result) == 16


def test_pseudonymise_deterministic():
    from ml_engine.ingestion.ehr import pseudonymise
    assert pseudonymise("10001") == pseudonymise("10001")


def test_pseudonymise_different_ids():
    from ml_engine.ingestion.ehr import pseudonymise
    assert pseudonymise("10001") != pseudonymise("10002")


# ── Tests: unit harmonisation ────────────────────────────────────────────────

def test_harmonise_mgdl_to_mmol():
    from ml_engine.ingestion.ehr import harmonise_unit
    value_si, uom_si = harmonise_unit(90.0, "mg/dL")
    assert uom_si == "mmol/L"
    assert abs(value_si - 4.996) < 0.01


def test_harmonise_gdl_to_gl():
    from ml_engine.ingestion.ehr import harmonise_unit
    value_si, uom_si = harmonise_unit(13.2, "g/dL")
    assert uom_si == "g/L"
    assert abs(value_si - 132.0) < 0.01


def test_harmonise_unknown_unit_passthrough():
    from ml_engine.ingestion.ehr import harmonise_unit
    value_si, uom_si = harmonise_unit(5.2, "mmol/L")
    assert value_si == 5.2
    assert uom_si == "mmol/L"


def test_harmonise_none_value():
    from ml_engine.ingestion.ehr import harmonise_unit
    value_si, uom_si = harmonise_unit(None, "mg/dL")
    assert value_si is None


# ── Tests: ingest_ehr ─────────────────────────────────────────────────────────

def test_ingest_ehr_basic():
    from ml_engine.ingestion.ehr import ingest_ehr

    with patch("ml_engine.ingestion.ehr.load_d_labitems", return_value=MOCK_D_LABITEMS), \
         patch("ml_engine.ingestion.ehr.load_labevents", return_value=MOCK_LABEVENTS):
        rows, manifest = ingest_ehr("/fake/mimic")

    assert len(rows) == 3
    assert manifest.n_rows == 3
    assert manifest.n_subjects == 2
    assert manifest.deidentified is True
    assert manifest.license_cleared is False  # MIMIC ODbL — never True


def test_ingest_ehr_deidentified():
    """subject_id must be pseudonymised, never raw."""
    from ml_engine.ingestion.ehr import ingest_ehr

    with patch("ml_engine.ingestion.ehr.load_d_labitems", return_value=MOCK_D_LABITEMS), \
         patch("ml_engine.ingestion.ehr.load_labevents", return_value=MOCK_LABEVENTS):
        rows, _ = ingest_ehr("/fake/mimic")

    for row in rows:
        assert row.subject_id not in ("10001", "10002"), "Raw subject_id leaked!"
        assert len(row.subject_id) == 16


def test_ingest_ehr_loinc_mapping():
    """LOINC codes should be mapped for known itemids."""
    from ml_engine.ingestion.ehr import ingest_ehr

    with patch("ml_engine.ingestion.ehr.load_d_labitems", return_value=MOCK_D_LABITEMS), \
         patch("ml_engine.ingestion.ehr.load_labevents", return_value=MOCK_LABEVENTS):
        rows, _ = ingest_ehr("/fake/mimic")

    glucose = next(r for r in rows if r.itemid == "50931")
    assert glucose.loinc_code == "2345-7"


def test_ingest_ehr_license_cleared_false():
    """license_cleared must always be False for MIMIC data."""
    from ml_engine.ingestion.ehr import ingest_ehr

    with patch("ml_engine.ingestion.ehr.load_d_labitems", return_value=MOCK_D_LABITEMS), \
         patch("ml_engine.ingestion.ehr.load_labevents", return_value=MOCK_LABEVENTS):
        rows, manifest = ingest_ehr("/fake/mimic")

    assert manifest.license_cleared is False
    for row in rows:
        assert row.license_cleared is False


def test_ingest_ehr_analytes_list():
    """Manifest should list unique analyte labels."""
    from ml_engine.ingestion.ehr import ingest_ehr

    with patch("ml_engine.ingestion.ehr.load_d_labitems", return_value=MOCK_D_LABITEMS), \
         patch("ml_engine.ingestion.ehr.load_labevents", return_value=MOCK_LABEVENTS):
        _, manifest = ingest_ehr("/fake/mimic")

    assert "Glucose" in manifest.analytes
    assert "Hemoglobin" in manifest.analytes


def test_lab_row_as_dict():
    """LabRow.as_dict() should return serialisable dict."""
    from ml_engine.ingestion.ehr import LabRow
    row = LabRow(
        subject_id="abc123",
        hadm_id="20001",
        itemid="50931",
        label="Glucose",
        loinc_code="2345-7",
        value=5.2,
        value_uom="mmol/L",
        value_si=5.2,
        uom_si="mmol/L",
        flag="",
    )
    d = row.as_dict()
    assert d["label"] == "Glucose"
    assert d["license_cleared"] is False
