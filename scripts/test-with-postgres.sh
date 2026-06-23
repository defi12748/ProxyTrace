#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.test.yml"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/proxytrace"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v
}

trap cleanup EXIT

echo "Starting disposable Postgres test database..."
docker compose -f "$COMPOSE_FILE" up -d --wait postgres

echo "Applying migrations..."
(
  cd "$ROOT"
  export DATABASE_URL
  python -m alembic upgrade head
)

echo "Running test suite..."
(
  cd "$ROOT"
  export DATABASE_URL
  python -m pytest -q
)
