"""
Clinical NER extension для SOAP-заметок и клинических энкаунтеров.
Расширяет openmed_ner_service.py функцией extract_clinical_entities().
SCRUM-OM-4
"""

import json
import logging
import re
from typing import Optional

import openmed
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ClinicalEntities(BaseModel):
    """Структурированные медицинские сущности из SOAP-заметки."""
    symptoms: list[str] = []
    diagnoses: list[str] = []
    medications: list[str] = []
    procedures: list[str] = []
    anatomical_sites: list[str] = []


# Ключевые слова для классификации сущностей на русском языке
SYMPTOM_KEYWORDS = [
    "боль", "болит", "жалоб", "слабость", "головокружение", "тошнот",
    "рвот", "одышк", "кашел", "температур", "озноб", "отёк", "зуд",
    "онемени", "судорог", "потер", "обморок", "усталост",
]

DIAGNOSIS_KEYWORDS = [
    "диагноз", "гипертони", "диабет", "инфаркт", "инсульт", "пневмони",
    "бронхит", "артрит", "остеопороз", "анемия", "депресси", "тревожност",
    "деменци", "паркинсон", "альцгеймер", "атеросклероз", "ишемическ",
]

MEDICATION_KEYWORDS = [
    "таблетк", "капсул", "мг", "ml", "инъекци", "укол", "капельниц",
    "аспирин", "метформин", "эналаприл", "омепразол", "амоксициллин",
    "лозартан", "аторвастатин", "метопролол", "варфарин",
]

PROCEDURE_KEYWORDS = [
    "узи", "мрт", "кт", "рентген", "экг", "эхо", "анализ", "биопси",
    "операци", "хирурги", "физиотерапи", "массаж", "консультаци",
]

ANATOMICAL_KEYWORDS = [
    "сердц", "легк", "печен", "почк", "мозг", "желудок", "кишечник",
    "позвоночник", "сустав", "колен", "плеч", "голов", "грудн",
    "брюшн", "спин", "шей", "поясниц",
]


def _classify_entity(text: str) -> Optional[str]:
    """Классифицирует текстовую сущность по категории."""
    text_lower = text.lower()

    for kw in SYMPTOM_KEYWORDS:
        if kw in text_lower:
            return "symptom"
    for kw in DIAGNOSIS_KEYWORDS:
        if kw in text_lower:
            return "diagnosis"
    for kw in MEDICATION_KEYWORDS:
        if kw in text_lower:
            return "medication"
    for kw in PROCEDURE_KEYWORDS:
        if kw in text_lower:
            return "procedure"
    for kw in ANATOMICAL_KEYWORDS:
        if kw in text_lower:
            return "anatomical"

    return None

# TOdo  : MVP — keyword-based classification.
# Replace with proper multilingual clinical NER model in future iterations.
def extract_clinical_entities(text: str) -> ClinicalEntities:
    """
    Извлекает структурированные медицинские сущности из SOAP-заметки.

    Использует OpenMed + keyword-классификацию для русскоязычных текстов.

    Args:
        text: Свободный текст врача (SOAP-заметка)

    Returns:
        ClinicalEntities с симптомами, диагнозами, лекарствами, процедурами
    """
    if not text or not text.strip():
        return ClinicalEntities()

    entities = ClinicalEntities()

    # Шаг 1: OpenMed NER
    try:
        result = openmed.extract_pii(text)
        for entity in result.entities:
            raw = entity.text
            category = _classify_entity(raw)
            if category == "symptom" and raw not in entities.symptoms:
                entities.symptoms.append(raw)
            elif category == "diagnosis" and raw not in entities.diagnoses:
                entities.diagnoses.append(raw)
            elif category == "medication" and raw not in entities.medications:
                entities.medications.append(raw)
            elif category == "procedure" and raw not in entities.procedures:
                entities.procedures.append(raw)
            elif category == "anatomical" and raw not in entities.anatomical_sites:
                entities.anatomical_sites.append(raw)
    except Exception as e:
        logger.error(f"OpenMed NER failed: {e}")

    # Шаг 2: Keyword-based extraction для русского текста
    sentences = re.split(r'[.!?\n]', text)
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        category = _classify_entity(sentence)
        if category == "symptom" and sentence not in entities.symptoms:
            entities.symptoms.append(sentence)
        elif category == "diagnosis" and sentence not in entities.diagnoses:
            entities.diagnoses.append(sentence)
        elif category == "medication" and sentence not in entities.medications:
            entities.medications.append(sentence)
        elif category == "procedure" and sentence not in entities.procedures:
            entities.procedures.append(sentence)
        elif category == "anatomical" and sentence not in entities.anatomical_sites:
            entities.anatomical_sites.append(sentence)

    return entities


def clinical_entities_to_json(entities: ClinicalEntities) -> str:
    """Сериализует ClinicalEntities в JSON для сохранения в БД."""
    return entities.model_dump_json()


def clinical_entities_from_json(json_str: str) -> ClinicalEntities:
    """Десериализует ClinicalEntities из JSON строки БД."""
    try:
        return ClinicalEntities.model_validate_json(json_str)
    except Exception:
        return ClinicalEntities()
