# MRI AI engine — inference service (§7.5). Deploys alongside the platform
# backend; mount its endpoints or run standalone. CPU image by default; for GPU
# inference use an nvidia/cuda base and install the cuda torch wheel.
FROM python:3.12-slim

WORKDIR /app

# System libs for nibabel/medical IO.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Inference deps (CPU torch keeps the image small; swap for cu121 on GPU hosts).
RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir \
    numpy scikit-learn fastapi uvicorn python-multipart nibabel pydicom \
    transformers peft

COPY ml_engine /app/ml_engine

# Provide trained checkpoints at runtime via env + a mounted volume:
#   docker run -e AMAN_ML_ENCODER_CKPT=/ckpts/mr-encoder.pt \
#              -e AMAN_ML_TRIAGE_CKPT=/ckpts/mr-triage.pt \
#              -v /host/ckpts:/ckpts -p 8001:8001 aman-ml-serving
EXPOSE 8001
CMD ["uvicorn", "ml_engine.serving.app:create_default_app", "--factory", \
     "--host", "0.0.0.0", "--port", "8001"]
