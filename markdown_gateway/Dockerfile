# syntax=docker/dockerfile:1.7

# builder stage
FROM python:3.12 AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip wheel --wheel-dir /wheels -r requirements.txt

# final stage
FROM python:3.12-slim AS final
WORKDIR /app
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && rm -rf /wheels
RUN useradd --create-home appuser
COPY app.py .
USER appuser
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
