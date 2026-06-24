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


def deidentify(text: str) -> str:
    """
    Деидентифицирует персональные данные в тексте с помощью OpenMed.

    Маскирует: ФИО, даты рождения, ИИН, телефоны, адреса.

    Args:
        text: Исходный клинический текст

    Returns:
        Текст с заменёнными персональными данными на метки вида [first_name], [date] и т.д.
    """
    if not text or not text.strip():
        return text

    try:
        result = openmed.deidentify(text)
        deidentified = result.deidentified_text
        logger.info(
            f"PII deidentification: {len(result.pii_entities)} entities masked"
        )
        return deidentified
    except Exception as e:
        logger.error(f"OpenMed deidentify failed: {e}. Falling back to regex.")
        return _regex_fallback_deidentify(text)


def _regex_fallback_deidentify(text: str) -> str:
    """
    Резервная деидентификация через regex если OpenMed недоступен.
    Покрывает казахстанские ИИН, телефоны, даты.
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
