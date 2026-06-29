FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (including those needed for OpenMed/torch)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download OpenMed model at build time to avoid cold start
# Model: OpenMed/OpenMed-PII-SuperClinical-Small-44M-v1
RUN python -c "\
import os; \
os.environ['OPENMED_CACHE_DIR'] = '/app/.cache/openmed'; \
import openmed; \
openmed.extract_pii('health check') \
" || echo "Model pre-download skipped (no network at build time)"

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
