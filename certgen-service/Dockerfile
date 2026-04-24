# CertVault PDF certificate generator (from GradeX certgen-service)
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev zlib1g-dev \
    fontconfig fonts-dejavu-core fonts-dejavu-extra fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY templates ./templates
COPY fonts ./fonts
RUN mkdir -p output

ENV PORT=5050
ENV CERTGEN_VERSION=2026-04-25-font-hardening
EXPOSE 5050

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --timeout 600 app:app"]
