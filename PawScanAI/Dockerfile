FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
ENV REACT_APP_API_URL=/predict
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    TF_CPP_MIN_LOG_LEVEL=2 CUDA_VISIBLE_DEVICES=-1 \
    MPLCONFIGDIR=/tmp/matplotlib KERAS_HOME=/tmp/keras \
    TF_NUM_INTRAOP_THREADS=1 TF_NUM_INTEROP_THREADS=1 PORT=8080
WORKDIR /app
COPY api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api/main.py ./api/main.py
COPY api/dog_model.py ./api/dog_model.py
COPY scripts/prepare_dog_model.py ./scripts/prepare_dog_model.py
# Download genuine pretrained weights during the build, never on a prediction.
RUN python scripts/prepare_dog_model.py
COPY --from=frontend /build/build ./frontend/build
RUN useradd --create-home --uid 10001 appuser
USER appuser
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
