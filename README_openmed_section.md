## OpenMed Integration

Aman AI использует [OpenMed](https://huggingface.co/OpenMed) для обработки медицинских текстов:

- **NER биомаркеров** — автоматическое извлечение значений из анализов крови
- **PII деидентификация** — маскировка персональных данных перед сохранением в БД
- **Clinical NER** — извлечение симптомов, диагнозов, лекарств из SOAP-заметок
- **PDF парсинг** — умный парсер медицинских документов с определением типа

### Модель

`OpenMed/OpenMed-PII-SuperClinical-Small-44M-v1` — 44M параметров, поддерживает русский язык.

### Конфигурация

```env
OPENMED_MODEL_NAME=OpenMed/OpenMed-PII-SuperClinical-Small-44M-v1
OPENMED_DEVICE=cpu  # или cuda если есть GPU
PII_DEIDENTIFICATION_ENABLED=true
OPENMED_CACHE_DIR=/app/.cache/openmed
```

### Тесты

```bash
cd backend
python -m pytest ../tests/test_openmed_ner_service.py \
                 ../tests/test_clinical_ner_service.py \
                 ../tests/test_pdf_parser_ner.py \
                 ../tests/test_blood_extractor_openmed.py \
                 ../tests/test_pii_deidentifier.py -v
# 29/29 passed
```

Подробнее: [docs/openmed-integration.md](docs/openmed-integration.md)
