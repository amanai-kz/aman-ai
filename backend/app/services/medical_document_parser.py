"""
MedicalDocumentParser — улучшенный PDF-парсер медицинских документов.
Объединяет PDF-текст + OpenMed NER + PII-деидентификацию.
SCRUM-OM-5

Зависимости: SCRUM-OM-1, SCRUM-OM-2, SCRUM-OM-3
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.services.openmed_ner_service import extract_blood_biomarkers_as_dict
from app.services.clinical_ner_service import extract_clinical_entities, ClinicalEntities
from app.services.pii_deidentifier import deidentify_if_enabled

logger = logging.getLogger(__name__)


class DocumentType(str, Enum):
    LAB_RESULTS = "lab_results"        # Лабораторные анализы
    EPICRISIS = "epicrisis"            # Эпикризы / выписки
    REFERRAL = "referral"              # Направления
    SOAP_NOTE = "soap_note"            # SOAP-заметки
    SCAN = "scan"                      # Сканы (нечитаемые PDF)
    UNKNOWN = "unknown"


@dataclass
class MedicalDocument:
    """Результат парсинга медицинского PDF-документа."""
    raw_text: str = ""
    deidentified_text: str = ""
    document_type: DocumentType = DocumentType.UNKNOWN
    clinical_entities: Optional[ClinicalEntities] = None
    biomarkers: Optional[dict] = None
    page_count: int = 0
    is_scanned: bool = False
    error: Optional[str] = None


def _detect_document_type(text: str) -> DocumentType:
    """Определяет тип медицинского документа по ключевым словам."""
    text_lower = text.lower()

    lab_keywords = ["гемоглобин", "глюкоза", "холестерин", "alt", "ast", "лейкоцит", "тромбоцит", "анализ крови"]
    epicrisis_keywords = ["выписка", "эпикриз", "история болезни", "госпитализац", "выписной"]
    referral_keywords = ["направление", "направляется", "консультаци", "осмотр", "к врачу"]
    soap_keywords = ["субъективно", "объективно", "оценка", "план", "soap", "жалобы пациента"]

    for kw in lab_keywords:
        if kw in text_lower:
            return DocumentType.LAB_RESULTS
    for kw in epicrisis_keywords:
        if kw in text_lower:
            return DocumentType.EPICRISIS
    for kw in referral_keywords:
        if kw in text_lower:
            return DocumentType.REFERRAL
    for kw in soap_keywords:
        if kw in text_lower:
            return DocumentType.SOAP_NOTE

    return DocumentType.UNKNOWN


def _is_scanned_pdf(text: str) -> bool:
    """Определяет является ли PDF сканом (мало текста или нет текста)."""
    if not text:
        return True
    words = text.split()
    return len(words) < 20


class MedicalDocumentParser:
    """
    Улучшенный PDF-парсер медицинских документов.

    Пайплайн:
    1. Извлечение текста из PDF (через существующий pdf_parser.py)
    2. Определение типа документа
    3. PII-деидентификация (SCRUM-OM-3)
    4. NER-извлечение сущностей (SCRUM-OM-2, SCRUM-OM-4)
    5. Возврат структурированного MedicalDocument
    """

    def __init__(self, pii_deidentification_enabled: bool = True):
        self.pii_enabled = pii_deidentification_enabled

    def parse(self, text: str, page_count: int = 1) -> MedicalDocument:
        """
        Парсит извлечённый PDF-текст через NER-пайплайн.

        Args:
            text: Текст извлечённый из PDF (через pdfplumber/pymupdf)
            page_count: Количество страниц документа

        Returns:
            MedicalDocument со всеми извлечёнными данными
        """
        doc = MedicalDocument(raw_text=text, page_count=page_count)

        # Шаг 1: Проверка на скан
        if _is_scanned_pdf(text):
            logger.warning("PDF appears to be scanned — skipping NER, returning raw text")
            doc.is_scanned = True
            doc.document_type = DocumentType.SCAN
            return doc

        # Шаг 2: Определение типа документа
        doc.document_type = _detect_document_type(text)
        logger.info(f"Document type detected: {doc.document_type}")

        # Шаг 3: PII-деидентификация (SCRUM-OM-3)
        try:
            doc.deidentified_text = deidentify_if_enabled(text, enabled=self.pii_enabled)
        except Exception as e:
            logger.error(f"PII deidentification failed: {e}")
            doc.deidentified_text = text

        # Шаг 4: NER в зависимости от типа документа
        try:
            if doc.document_type == DocumentType.LAB_RESULTS:
                # Биомаркеры крови (SCRUM-OM-2)
                doc.biomarkers = extract_blood_biomarkers_as_dict(text)
                logger.info(f"Biomarkers extracted: {doc.biomarkers.get('summary', {})}")

            elif doc.document_type in (DocumentType.EPICRISIS, DocumentType.SOAP_NOTE, DocumentType.REFERRAL):
                # Клинические сущности (SCRUM-OM-4)
                doc.clinical_entities = extract_clinical_entities(text)
                logger.info(f"Clinical entities extracted: {doc.clinical_entities}")

            else:
                # Неизвестный тип — извлекаем всё
                doc.biomarkers = extract_blood_biomarkers_as_dict(text)
                doc.clinical_entities = extract_clinical_entities(text)

        except Exception as e:
            logger.error(f"NER extraction failed: {e}")
            doc.error = str(e)

        return doc

    def parse_multipage(self, pages_text: list[str]) -> MedicalDocument:
        """
        Парсит многостраничный документ с агрегацией сущностей.

        Args:
            pages_text: Список текстов по страницам

        Returns:
            MedicalDocument с агрегированными данными всех страниц
        """
        full_text = "\n\n".join(pages_text)
        return self.parse(full_text, page_count=len(pages_text))


# Глобальный экземпляр парсера
medical_parser = MedicalDocumentParser(pii_deidentification_enabled=True)


def parse_medical_pdf_text(text: str, page_count: int = 1) -> dict:
    """
    Главная точка входа для парсинга медицинских PDF.
    Используется в blood.py и других endpoint-ах.

    Args:
        text: Текст из PDF
        page_count: Количество страниц

    Returns:
        dict с raw_text, deidentified_text, document_type, entities/biomarkers
    """
    doc = medical_parser.parse(text, page_count)

    result = {
        "raw_text": doc.raw_text,
        "deidentified_text": doc.deidentified_text,
        "document_type": doc.document_type.value,
        "page_count": doc.page_count,
        "is_scanned": doc.is_scanned,
    }

    if doc.biomarkers:
        result["biomarkers"] = doc.biomarkers
    if doc.clinical_entities:
        result["clinical_entities"] = doc.clinical_entities.model_dump()
    if doc.error:
        result["error"] = doc.error

    return result
