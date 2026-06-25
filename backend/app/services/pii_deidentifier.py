"""
PII De-identification Service using OpenMed.
Автоматически маскирует персональные данные перед сохранением в БД.
SCRUM-OM-3
"""

import logging
import re
from typing import Optional

import openmed

logger = logging.getLogger(__name__)


def _regex_fallback_deidentify(text: str) -> str:
    """
    Дополнительная деидентификация через regex.
    Покрывает казахстанские ИИН, телефоны, даты — то что OpenMed пропускает.
    Запускается ВСЕГДА поверх результата OpenMed (defense-in-depth).
    """
    # ИИН Казахстана (12 цифр)
    text = re.sub(r"\b\d{12}\b", "[ИИН]", text)

    # Телефоны (+7 XXX XXX XX XX)
    text = re.sub(
        r"(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}",
        "[телефон]",
        text,
    )

    # Даты (DD.MM.YYYY, DD/MM/YYYY)
    text = re.sub(
        r"\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b",
        "[дата]",
        text,
    )

    return text


def deidentify(text: str) -> str:
    """
    Деидентифицирует персональные данные в тексте.

    Двухуровневый подход (defense-in-depth):
    1. OpenMed — маскирует ФИО, адреса и другие сущности
    2. Regex — всегда маскирует KZ-специфику: ИИН, телефоны, даты

    Args:
        text: Исходный клинический текст

    Returns:
        Текст с заменёнными персональными данными
    """
    if not text or not text.strip():
        return text

    # Шаг 1: OpenMed деидентификация
    try:
        result = openmed.deidentify(text)
        deid_text = result.deidentified_text
        logger.info(
            f"PII deidentification: {len(result.pii_entities)} entities masked by OpenMed"
        )
    except Exception as e:
        logger.error(f"OpenMed deidentify failed: {e}. Using regex only.")
        deid_text = text

    # Шаг 2: Regex поверх результата OpenMed — всегда
    # ИИН/телефон/даты OpenMed пропускает, regex гарантированно закрывает KZ-специфику
    return _regex_fallback_deidentify(deid_text)


def deidentify_if_enabled(text: str, enabled: bool = True) -> str:
    """
    Деидентифицирует текст только если feature flag включён.

    Args:
        text: Исходный текст
        enabled: Значение PII_DEIDENTIFICATION_ENABLED из config

    Returns:
        Деидентифицированный текст если enabled=True, иначе исходный
    """
    if not enabled:
        logger.debug("PII deidentification disabled via feature flag")
        return text
    return deidentify(text)
