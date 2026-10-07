#!/usr/bin/env bash
# =============================================================================
# scripts/build.sh -- Local build and deployment helper
# =============================================================================
# Usage:
#   ./scripts/build.sh [dev|prod|down|logs|seed|status]
#
# Commands:
#   dev     Build and start all services in development mode (default)
#   prod    Build and start all services in production mode
#   down    Stop and remove all containers (volumes are preserved)
#   logs    Tail logs for all services
#   seed    Run the Prisma seed against the running API container
#   status  Show container health and port bindings
# =============================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
COMPOSE_PROD_OVERRIDE="docker-compose.prod.yml"
PROJECT_NAME="codemie-meetingnotes"

cmd="${1:-dev}"

check_env() {
  if [[ ! -f ".env" ]]; then
    echo "[ERROR] .env file not found. Copy .env.example to .env and fill in values."
    exit 1
  fi
}

case "$cmd" in
  dev)
    check_env
    echo "[build.sh] Starting in DEVELOPMENT mode..."
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up --build
    ;;

  prod)
    check_env
    echo "[build.sh] Starting in PRODUCTION mode..."
    docker compose -p "$PROJECT_NAME"       -f "$COMPOSE_FILE"       -f "$COMPOSE_PROD_OVERRIDE"       up --build -d
    echo "[build.sh] Services started. Run: ./scripts/build.sh status"
    ;;

  down)
    echo "[build.sh] Stopping all containers..."
    docker compose -p "$PROJECT_NAME" down
    ;;

  logs)
    docker compose -p "$PROJECT_NAME" logs -f
    ;;

  seed)
    echo "[build.sh] Running Prisma seed..."
    docker compose -p "$PROJECT_NAME" exec api node prisma/seed.js
    ;;

  status)
    docker compose -p "$PROJECT_NAME" ps
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Usage: ./scripts/build.sh [dev|prod|down|logs|seed|status]"
    exit 1
    ;;
esac
