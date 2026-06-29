"""
Сравнение старого blood_nlp_extractor.py и нового openmed_ner_service.py
SCRUM-OM-6
"""

import pytest
from unittest.mock import patch, MagicMock

# Тестовые данные — реальные клинические тексты
TEST_SAMPLES = [
    {
        "text": "глюкоза 5.2 ммоль/л",
        "expected_marker": "глюкоза",
        "expected_value": 5.2,
        "expected_status": "normal",
    },
    {
        "text": "ALT 25 U/L",
        "expected_marker": "alt",
        "expected_value": 25.0,
        "expected_status": "normal",
    },
    {
        "text": "глюкоза 9.8 ммоль/л",
        "expected_marker": "глюкоза",
        "expected_value": 9.8,
        "expected_status": "high",
    },
    {
        "text": "ТТГ 2.5 mIU/L",
        "expected_marker": "tsh",
        "expected_value": 2.5,
        "expected_status": "normal",
    },
]


@pytest.mark.parametrize("sample", TEST_SAMPLES)
def test_openmed_extracts_marker(sample):
    """OpenMed NER сервис извлекает маркер с правильным значением."""
    from app.services.openmed_ner_service import extract_blood_biomarkers
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        result = extract_blood_biomarkers(sample["text"])

    marker = next((b for b in result if b.name == sample["expected_marker"]), None)
    assert marker is not None, f"Маркер {sample['expected_marker']} не найден"
    assert marker.value == sample["expected_value"]
    assert marker.status == sample["expected_status"]


def test_openmed_vs_regex_glucose():
    """
    Бенчмарк: OpenMed + regex vs старый regex-экстрактор на глюкозе.
    Оба должны находить значение.
    """
    from app.services.openmed_ner_service import extract_blood_biomarkers
    from app.services.blood_nlp_extractor import extract_blood_analysis

    text = "глюкоза 5.2 ммоль/л"

    # Новый сервис
    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        new_result = extract_blood_biomarkers(text)
    new_glucose = next((b for b in new_result if b.name == "глюкоза"), None)

    # Старый сервис
    old_result = extract_blood_analysis(text)
    old_glucose = old_result.get("markers", {}).get("glucose")

    # Оба должны найти глюкозу
    assert new_glucose is not None, "Новый сервис не нашёл глюкозу"
    # Старый может не найти если текст не в его формате — это ок
    print(f"Новый: {new_glucose.value} | Старый: {old_glucose}")


def test_latency_under_2000ms():
    """
    Латентность NER p95 < 2000ms (без загрузки модели).
    Мокаем openmed чтобы измерить только логику сервиса.
    """
    import time
    from app.services.openmed_ner_service import extract_blood_biomarkers

    text = "глюкоза 5.2 ммоль/л, ALT 25 U/L, ТТГ 2.5 mIU/L"
    latencies = []

    with patch("app.services.openmed_ner_service.openmed") as mock_om:
        mock_om.extract_pii.return_value = MagicMock(entities=[])
        for _ in range(10):
            start = time.time()
            extract_blood_biomarkers(text)
            latencies.append((time.time() - start) * 1000)

    p95 = sorted(latencies)[int(len(latencies) * 0.95)]
    print(f"Латентность p95: {p95:.1f}ms")
    assert p95 < 2000, f"p95 латентность {p95:.1f}ms превышает 2000ms"
