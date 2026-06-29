"""
Pytest тесты для medical_document_parser.py
SCRUM-OM-6
"""

import pytest
from unittest.mock import patch, MagicMock


# ── Тесты детекта типа документа ──────────────────────────────────────────────

def test_detect_lab_results():
    """Лабораторные анализы корректно определяются."""
    from app.services.medical_document_parser import _detect_document_type, DocumentType
    text = "Гемоглобин 132 г/л, глюкоза 5.2 ммоль/л, ALT 25 U/L"
    assert _detect_document_type(text) == DocumentType.LAB_RESULTS


def test_detect_epicrisis():
    """Эпикриз корректно определяется."""
    from app.services.medical_document_parser import _detect_document_type, DocumentType
    text = "Выписка из истории болезни. Пациент поступил с диагнозом."
    assert _detect_document_type(text) == DocumentType.EPICRISIS


def test_detect_referral():
    """Направление корректно определяется."""
    from app.services.medical_document_parser import _detect_document_type, DocumentType
    text = "Направление на консультацию к кардиологу."
    assert _detect_document_type(text) == DocumentType.REFERRAL


def test_detect_scan():
    """Скан (мало текста) корректно определяется."""
    from app.services.medical_document_parser import _is_scanned_pdf
    assert _is_scanned_pdf("") is True
    assert _is_scanned_pdf("мало слов") is True
    assert _is_scanned_pdf("а " * 25) is False


# ── Тесты MedicalDocumentParser ───────────────────────────────────────────────

def test_parse_scan_returns_raw():
    """Скан возвращает только raw текст без NER."""
    from app.services.medical_document_parser import MedicalDocumentParser, DocumentType
    parser = MedicalDocumentParser(pii_deidentification_enabled=False)
    doc = parser.parse("мало")
    assert doc.is_scanned is True
    assert doc.document_type == DocumentType.SCAN
    assert doc.clinical_entities is None
    assert doc.biomarkers is None


def test_parse_lab_results():
    """Лабораторный документ извлекает биомаркеры."""
    from app.services.medical_document_parser import MedicalDocumentParser
    parser = MedicalDocumentParser(pii_deidentification_enabled=False)
    with patch("app.services.medical_document_parser.extract_blood_biomarkers_as_dict") as mock_bio, \
         patch("app.services.medical_document_parser.deidentify_if_enabled") as mock_deid:
        mock_bio.return_value = {"markers": [], "summary": {"total_found": 1}}
        mock_deid.return_value = "текст"
        doc = parser.parse("глюкоза 5.2 ммоль/л гемоглобин 132 г/л анализ крови " * 3)
    assert doc.biomarkers is not None


def test_parse_multipage():
    """Многостраничный документ агрегируется корректно."""
    from app.services.medical_document_parser import MedicalDocumentParser
    parser = MedicalDocumentParser(pii_deidentification_enabled=False)
    pages = ["страница 1 текст", "страница 2 текст", "страница 3 текст"]
    with patch("app.services.medical_document_parser.deidentify_if_enabled") as mock_deid:
        mock_deid.return_value = "текст"
        doc = parser.parse_multipage(pages)
    assert doc.page_count == 3


def test_parse_result_structure():
    """parse_medical_pdf_text возвращает правильную структуру."""
    from app.services.medical_document_parser import parse_medical_pdf_text
    with patch("app.services.medical_document_parser.medical_parser") as mock_parser:
        mock_doc = MagicMock()
        mock_doc.raw_text = "текст"
        mock_doc.deidentified_text = "текст"
        mock_doc.document_type.value = "unknown"
        mock_doc.page_count = 1
        mock_doc.is_scanned = False
        mock_doc.biomarkers = None
        mock_doc.clinical_entities = None
        mock_doc.error = None
        mock_parser.parse.return_value = mock_doc
        result = parse_medical_pdf_text("текст")

    assert "raw_text" in result
    assert "deidentified_text" in result
    assert "document_type" in result
