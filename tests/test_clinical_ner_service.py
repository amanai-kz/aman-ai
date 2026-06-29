"""
Pytest тесты для clinical_ner_service.py
SCRUM-OM-6
"""

import pytest
from unittest.mock import patch, MagicMock


# ── Тесты extract_clinical_entities ───────────────────────────────────────────

def test_empty_text():
    """Пустой текст возвращает пустые списки."""
    from app.services.clinical_ner_service import extract_clinical_entities
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_clinical_entities("")
    assert result.symptoms == []
    assert result.diagnoses == []
    assert result.medications == []
    assert result.procedures == []
    assert result.anatomical_sites == []


def test_symptom_classification():
    """Симптомы правильно классифицируются."""
    from app.services.clinical_ner_service import extract_clinical_entities
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_clinical_entities("Жалобы: боль в груди и головокружение.")
    assert len(result.symptoms) > 0


def test_diagnosis_classification():
    """Диагнозы правильно классифицируются."""
    from app.services.clinical_ner_service import extract_clinical_entities
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_clinical_entities("Диагноз: гипертония.")
    assert len(result.diagnoses) > 0


def test_medication_classification():
    """Лекарства правильно классифицируются."""
    from app.services.clinical_ner_service import extract_clinical_entities
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_clinical_entities("Назначен аспирин 100мг.")
    assert len(result.medications) > 0


def test_procedure_classification():
    """Процедуры правильно классифицируются."""
    from app.services.clinical_ner_service import extract_clinical_entities
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_clinical_entities("Рекомендовано УЗИ сердца.")
    assert len(result.procedures) > 0


def test_full_soap_note():
    """Полная SOAP-заметка извлекает все типы сущностей."""
    from app.services.clinical_ner_service import extract_clinical_entities
    text = (
        "Жалобы: боль в груди и головокружение. "
        "Диагноз: гипертония. "
        "Назначен аспирин 100мг. "
        "Рекомендовано УЗИ сердца."
    )
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_clinical_entities(text)
    assert len(result.symptoms) > 0
    assert len(result.diagnoses) > 0
    assert len(result.medications) > 0
    assert len(result.procedures) > 0


def test_json_serialization():
    """ClinicalEntities сериализуется и десериализуется корректно."""
    from app.services.clinical_ner_service import (
        extract_clinical_entities,
        clinical_entities_to_json,
        clinical_entities_from_json,
    )
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        entities = extract_clinical_entities("Диагноз: гипертония.")

    json_str = clinical_entities_to_json(entities)
    restored = clinical_entities_from_json(json_str)
    assert restored.diagnoses == entities.diagnoses


def test_openmed_failure_fallback():
    """При ошибке OpenMed keyword-fallback всё равно работает."""
    from app.services.clinical_ner_service import extract_clinical_entities
    with patch("app.services.clinical_ner_service.openmed") as mock_om:
        mock_om.extract_pii.side_effect = Exception("OpenMed unavailable")
        result = extract_clinical_entities("Диагноз: гипертония. Боль в груди.")
    assert len(result.diagnoses) > 0 or len(result.symptoms) > 0
