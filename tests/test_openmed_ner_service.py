"""
Pytest тесты для openmed_ner_service.py
SCRUM-OM-6
"""

import pytest
from unittest.mock import patch, MagicMock


# ── Фикстуры ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_openmed_entity():
    """Фиктивная сущность OpenMed."""
    entity = MagicMock()
    entity.text = "Гемоглобин"
    entity.label = "lab_test"
    entity.confidence = 0.9
    return entity


@pytest.fixture
def mock_openmed_result(mock_openmed_entity):
    """Фиктивный результат openmed.extract_pii()."""
    result = MagicMock()
    result.entities = [mock_openmed_entity]
    return result


# ── Тесты extract_blood_biomarkers ────────────────────────────────────────────

def test_extract_empty_text():
    """Пустой текст возвращает пустой список."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    assert extract_blood_biomarkers("") == []
    assert extract_blood_biomarkers("   ") == []


def test_extract_glucose_value():
    """Глюкоза извлекается с правильным значением и статусом."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_blood_biomarkers("глюкоза 5.2 ммоль/л")

    glucose = next((b for b in result if b.name == "глюкоза"), None)
    assert glucose is not None
    assert glucose.value == 5.2
    assert glucose.unit == "mmol/L"
    assert glucose.status == "normal"


def test_extract_high_glucose():
    """Высокая глюкоза имеет статус high."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_blood_biomarkers("глюкоза 9.5 ммоль/л")

    glucose = next((b for b in result if b.name == "глюкоза"), None)
    assert glucose is not None
    assert glucose.status in ("high", "critical_high")


def test_extract_alt_value():
    """ALT извлекается корректно."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_blood_biomarkers("ALT 25 U/L")

    alt = next((b for b in result if b.name == "alt"), None)
    assert alt is not None
    assert alt.value == 25.0
    assert alt.status == "normal"


def test_extract_tsh_regex():
    """ТТГ/TSH распознаётся через regex."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_blood_biomarkers("ТТГ 2.5 mIU/L")

    tsh = next((b for b in result if b.name == "tsh"), None)
    assert tsh is not None
    assert tsh.value == 2.5


def test_openmed_failure_fallback():
    """При ошибке OpenMed regex-fallback всё равно работает."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.side_effect = Exception("OpenMed unavailable")
        result = extract_blood_biomarkers("глюкоза 5.2 ммоль/л")

    glucose = next((b for b in result if b.name == "глюкоза"), None)
    assert glucose is not None


# ── Тесты extract_blood_biomarkers_as_dict ────────────────────────────────────

def test_as_dict_structure():
    """extract_blood_biomarkers_as_dict возвращает правильную структуру."""
    from app.services.openmed_ner_service import extract_blood_biomarkers_as_dict
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_blood_biomarkers_as_dict("глюкоза 5.2 ммоль/л")

    assert "markers" in result
    assert "summary" in result
    assert "total_found" in result["summary"]
    assert "critical_count" in result["summary"]
    assert "warning_count" in result["summary"]
