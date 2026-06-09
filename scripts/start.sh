#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_NAME="amanai"
COMPOSE_FILE=".docker-compose.local.yml"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
DB_PORT="${DB_PORT:-5433}"
REDIS_PORT="${REDIS_PORT:-6380}"
HOST_UID="${HOST_UID:-$(id -u)}"
HOST_GID="${HOST_GID:-$(id -g)}"
export HOST_UID HOST_GID

cat > "$COMPOSE_FILE" <<EOF
services:
  db:
    image: postgres:15-alpine
    container_name: amanai-db
    environment:
      POSTGRES_USER: aman
      POSTGRES_PASSWORD: amanai2024secure
      POSTGRES_DB: amanai
    ports:
      - "${DB_PORT}:5432"
    volumes:
      - amanai_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aman -d amanai"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    container_name: amanai-redis
    ports:
      - "${REDIS_PORT}:6379"
    volumes:
      - amanai_redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: amanai-backend
    environment:
      DATABASE_URL: postgresql+asyncpg://aman:amanai2024secure@db:5432/amanai
      REDIS_URL: redis://redis:6379
      SECRET_KEY: dev-secret
      DEBUG: "true"
    ports:
      - "${BACKEND_PORT}:8000"
    volumes:
      - ./backend:/app
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  setup:
    image: node:20-bookworm
    working_dir: /app
    environment:
      DATABASE_URL: postgresql://aman:amanai2024secure@db:5432/amanai
    volumes:
      - .:/app
      - amanai_node_modules:/app/node_modules
    depends_on:
      db:
        condition: service_healthy

  frontend:
    image: node:20-bookworm
    container_name: amanai-frontend
    working_dir: /app
    environment:
      DATABASE_URL: postgresql://aman:amanai2024secure@db:5432/amanai
      AUTH_SECRET: dev-auth-secret
      NEXTAUTH_SECRET: dev-auth-secret
      AUTH_URL: http://localhost:${FRONTEND_PORT}
      NEXTAUTH_URL: http://localhost:${FRONTEND_PORT}
      NEXT_PUBLIC_API_URL: http://localhost:${BACKEND_PORT}/api/v1
      NEXT_TELEMETRY_DISABLED: "1"
    ports:
      - "${FRONTEND_PORT}:3000"
    volumes:
      - .:/app
      - amanai_node_modules:/app/node_modules
    depends_on:
      db:
        condition: service_healthy
      backend:
        condition: service_started
    command: >
      bash -lc "
        apt-get update &&
        apt-get install -y openssl ca-certificates &&
        if ! getent group amanhost >/dev/null; then groupadd -g ${HOST_GID} -o amanhost; fi &&
        if ! id -u amanhost >/dev/null 2>&1; then useradd -m -u ${HOST_UID} -g ${HOST_GID} -o -s /bin/bash amanhost; fi &&
        rm -f /app/next-env.d.ts &&
        rm -rf /app/.next/dev &&
        mkdir -p /app/.next &&
        chown -R ${HOST_UID}:${HOST_GID} /app/.next &&
        npm install &&
        npx prisma generate &&
        su amanhost -c 'npm run dev -- --hostname 0.0.0.0'
      "

volumes:
  amanai_postgres_data:
  amanai_redis_data:
  amanai_node_modules:
EOF

case "${1:-up}" in
  up|start)
    echo "🚀 Starting DB, Redis, and backend..."
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build db redis backend

    echo "🗄️ Preparing Prisma database..."
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" run --rm setup bash -lc "
      apt-get update &&
      apt-get install -y openssl ca-certificates &&
      npm install &&
      npx prisma generate &&
      npx prisma db push --accept-data-loss
    "

    read -r -p "🌱 Do you want to seed test users? [y/N] " seed_answer
    if [[ "$seed_answer" == "y" || "$seed_answer" == "Y" ]]; then
      docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" run --rm setup bash -lc "npm run db:seed"
    fi

    echo "🌐 Starting frontend..."
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build frontend

    echo ""
    echo "✅ AmanAI is running:"
    echo "Frontend: http://localhost:${FRONTEND_PORT}"
    echo "Backend:  http://localhost:${BACKEND_PORT}"
    echo "Docs:     http://localhost:${BACKEND_PORT}/api/v1/docs"
    echo ""
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" logs -f frontend backend
    ;;

  down|stop)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down
    ;;

  clean)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down -v --remove-orphans
    ;;

  logs)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" logs -f
    ;;

  seed)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" run --rm setup bash -lc "npm run db:seed"
    ;;

  *)
    echo "Usage: ./start.sh [start|down|clean|logs|seed]"
    exit 1
    ;;
esac
