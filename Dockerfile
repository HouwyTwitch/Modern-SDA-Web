# syntax=docker/dockerfile:1

# ---- Stage 1: build the web UI ----
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: backend + bundled UI ----
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    DATA_DIR=/app/data

WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install -r requirements.txt

COPY server/ ./
COPY --from=frontend /app/dist /app/dist

RUN mkdir -p /app/data
EXPOSE 8000

# Single server: API + built UI on one port.
CMD ["sh", "-c", "uvicorn main:app --host ${HOST} --port ${PORT}"]
