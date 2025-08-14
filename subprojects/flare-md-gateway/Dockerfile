FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY gateway/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY gateway /app/gateway
COPY gateway/uvicorn.ini /app/uvicorn.ini

# Security hardening lite
RUN useradd -r -u 10001 appuser
USER appuser

EXPOSE 49159
CMD ["python", "-m", "uvicorn", "gateway.app.main:app", "--host", "0.0.0.0", "--port", "49159", "--proxy-headers", "--no-server-header", "--workers", "2", "--log-config", "uvicorn.ini"]
