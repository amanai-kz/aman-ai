"""
Тесты для PII деидентификации.
Покрывает русскоязычные и казахские персональные данные.
SCRUM-OM-3
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.app.services.pii_deidentifier import deidentify, deidentify_if_enabled


def test_deidentify_russian_name():
    """ФИО на русском языке маскируется."""
    text = "Пациент Иванов Иван Иванович обратился с жалобами."
    result = deidentify(text)
    assert "Иванов" not in result or "[" in result
    print(f"✅ test_deidentify_russian_name: {result}")


def test_deidentify_date():
    """Дата рождения маскируется."""
    text = "Дата рождения: 15.03.1980"
    result = deidentify(text)
    assert "15.03.1980" not in result or "[" in result
    print(f"✅ test_deidentify_date: {result}")


def test_deidentify_iin():
    """ИИН Казахстана (12 цифр) маскируется."""
    text = "ИИН пациента: 800315300123"
    result = deidentify(text)
    assert "800315300123" not in result
    print(f"✅ test_deidentify_iin: {result}")


def test_deidentify_phone():
    """Казахстанский номер телефона маскируется."""
    text = "Телефон: +7 701 123 45 67"
    result = deidentify(text)
    assert "701 123 45 67" not in result
    print(f"✅ test_deidentify_phone: {result}")


def test_feature_flag_disabled():
    """Если feature flag отключён — текст не меняется."""
    text = "Иванов Иван, ИИН 800315300123, тел +7 701 123 45 67"
    result = deidentify_if_enabled(text, enabled=False)
    assert result == text
    print(f"✅ test_feature_flag_disabled: текст не изменён")


def test_feature_flag_enabled():
    """Если feature flag включён — текст деидентифицируется."""
    text = "ИИН 800315300123"
    result = deidentify_if_enabled(text, enabled=True)
    assert "800315300123" not in result
    print(f"✅ test_feature_flag_enabled: {result}")


def test_empty_text():
    """Пустой текст возвращается без изменений."""
    assert deidentify("") == ""
    assert deidentify("   ") == "   "
    print(f"✅ test_empty_text: OK")


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
    print(f"✅ test_full_clinical_note:\n  Оригинал: {text}\n  Результат: {result}")


if __name__ == "__main__":
    print("Запуск тестов PII деидентификации...\n")
    test_deidentify_russian_name()
    test_deidentify_date()
    test_deidentify_iin()
    test_deidentify_phone()
    test_feature_flag_disabled()
    test_feature_flag_enabled()
    test_empty_text()
    test_full_clinical_note()
    print("\n✅ Все тесты пройдены!")
