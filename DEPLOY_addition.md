## OpenMed Integration — Первый запуск

### Загрузка модели OpenMed

При первом запуске бэкенд автоматически скачивает модель (~500MB).
Это займёт 2-5 минут в зависимости от скорости соединения.

```bash
# Проверить что модель загрузилась
docker-compose -f docker-compose.prod.yml logs backend | grep "Loading weights"
```

### Переменные окружения для OpenMed

Добавь в `.env` файл на сервере:

```env
# OpenMed NER Integration
OPENMED_MODEL_NAME=OpenMed/OpenMed-PII-SuperClinical-Small-44M-v1
OPENMED_DEVICE=cpu
PII_DEIDENTIFICATION_ENABLED=true
OPENMED_CACHE_DIR=/app/.cache/openmed
```

Если на сервере есть NVIDIA GPU:
```env
OPENMED_DEVICE=cuda
```

### Health check OpenMed

```bash
# Проверить что NER работает
curl -X POST http://89.218.178.215:8000/api/v1/health

# Тест деидентификации
curl -X POST http://89.218.178.215:8000/api/v1/blood/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Глюкоза 5.2 ммоль/л"}'
```

### Кеш моделей

Модель кешируется в `OPENMED_CACHE_DIR`. При повторных запусках контейнера загрузка не нужна.
Для сохранения кеша между перезапусками добавь volume в `docker-compose.prod.yml`:

```yaml
backend:
  volumes:
    - openmed_cache:/app/.cache/openmed

volumes:
  openmed_cache:
```
