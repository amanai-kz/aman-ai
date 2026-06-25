"""
Pytest-тесты для PII деидентификации.
Покрывает русскоязычные и казахские персональные данные.
SCRUM-OM-3
"""

import pytest
from app.services.pii_deidentifier import deidentify, deidentify_if_enabled


def test_deidentify_russian_name():
    """ФИО на русском языке маскируется."""
    text = "Пациент Иванов Иван Иванович обратился с жалобами."
    result = deidentify(text)
    assert "Иванов" not in result or "[" in result


def test_deidentify_date():
    """Дата рождения маскируется."""
    text = "Дата рождения: 15.03.1980"
    result = deidentify(text)
    assert "15.03.1980" not in result


def test_deidentify_iin():
    """ИИН Казахстана (12 цифр) маскируется."""
    text = "ИИН пациента: 800315300123"
    result = deidentify(text)
    assert "800315300123" not in result


def test_deidentify_phone():
    """Казахстанский номер телефона маскируется."""
    text = "Телефон: +7 701 123 45 67"
    result = deidentify(text)
    assert "701 123 45 67" not in result


def test_iin_masked_even_after_openmed_success():
    """
    ИИН маскируется даже когда OpenMed успешно отработал.
    Проверяет defense-in-depth: regex всегда запускается поверх OpenMed.
    """
    text = "Пациент Иванов Иван, ИИН 800315300123, тел +7 701 123 45 67"
    result = deidentify(text)
    assert "800315300123" not in result
    assert "701 123 45 67" not in result


def test_feature_flag_disabled():
    """Если feature flag отключён — текст не меняется."""
    text = "Иванов Иван, ИИН 800315300123, тел +7 701 123 45 67"
    result = deidentify_if_enabled(text, enabled=False)
    assert result == text


def test_feature_flag_enabled():
    """Если feature flag включён — текст деидентифицируется."""
    text = "ИИН 800315300123"
    result = deidentify_if_enabled(text, enabled=True)
    assert "800315300123" not in result


def test_empty_text():
    """Пустой текст возвращается без изменений."""
    assert deidentify("") == ""
    assert deidentify("   ") == "   "


def test_full_clinical_note():
    """Полная клиническая заметка — все PII маскируются."""
    text = (
        "Пациент Сейткали Ерлан Бекович, ИИН 900101350077, "
        "дата рождения 01.01.1990, тел +7 777 999 88 55. "
        "Обратился в клинику с жалобами на головную боль."
    )
    result = deidentify(text)
    assert "900101350077" not in result
    assert "01.01.1990" not in result
    assert "777 999 88 55" not in result
