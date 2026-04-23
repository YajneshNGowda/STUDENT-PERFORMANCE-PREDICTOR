FROM python:3.11-slim AS backend

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build frontend
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Final image
FROM python:3.11-slim AS final
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=backend /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend /app .
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 8000

ENV DATABASE_URL=sqlite:///./data/eduguard.db
VOLUME ["/app/data", "/app/ml"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
