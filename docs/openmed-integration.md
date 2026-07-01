# OpenMed Integration — Архитектура и документация

**Эпик:** SCRUM-70  
**Статус:** Завершено

---

## Обзор

Aman AI использует OpenMed 1.5.5 для автоматической обработки медицинских текстов:
- NER (Named Entity Recognition) биомаркеров крови
- PII-деидентификация данных пациентов
- Clinical NER для SOAP-заметок
- Улучшенный PDF-парсер медицинских документов

---

## Архитектура

```
Медицинский PDF / SOAP-текст
        ↓
medical_document_parser.py
        ↓
  ┌─────────────────────────┐
  │  openmed_ner_service.py │ ← Биомаркеры крови (S5)
  │  clinical_ner_service.py│ ← SOAP-заметки (encounters)
  │  pii_deidentifier.py   │ ← PII до сохранения в БД
  └─────────────────────────┘
        ↓
    PostgreSQL
```

---

## Новые сервисы

| Файл | Назначение |
|---|---|
| `backend/app/services/openmed_ner_service.py` | Извлечение биомаркеров крови |
| `backend/app/services/clinical_ner_service.py` | Clinical NER для SOAP-заметок |
| `backend/app/services/pii_deidentifier.py` | PII деидентификация |
| `backend/app/services/medical_document_parser.py` | Unified PDF-парсер |

---

## Переменные окружения

```env
OPENMED_MODEL_NAME=OpenMed/OpenMed-PII-SuperClinical-Small-44M-v1
OPENMED_DEVICE=cpu
PII_DEIDENTIFICATION_ENABLED=true
OPENMED_CACHE_DIR=/app/.cache/openmed
```

---

## Первый запуск с OpenMed

При первом запуске модель скачивается автоматически (~500MB):

```bash
# Локально
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Docker
docker-compose up --build
```

Модель кешируется в `OPENMED_CACHE_DIR`. При повторных запусках загрузка не нужна.

---

## Тесты

```bash
cd backend
python -m pytest ../tests/test_openmed_ner_service.py \
                 ../tests/test_clinical_ner_service.py \
                 ../tests/test_pdf_parser_ner.py \
                 ../tests/test_blood_extractor_openmed.py \
                 ../tests/test_pii_deidentifier.py -v
```

Результат: **29/29 passed**

---

## Известные ограничения

- OpenMed PII-модель не покрывает казахстанские ИИН и телефоны → закрывается regex-слоем
- Clinical NER — MVP keyword-based решение, планируется заменить на специализированную модель
- Первый инференс медленный (~3-5 сек) из-за загрузки модели; после прогрева ~100-300ms
