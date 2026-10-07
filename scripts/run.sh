#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — Doctor Appointment Booking System
# Start the application in development mode (Docker DB + native npm processes)
# or in full Docker mode.
#
# Usage:
#   ./run.sh              # dev mode  (Docker DB + npm dev servers)
#   ./run.sh --docker     # full Docker Compose stack
#   ./run.sh --stop       # stop all running services
#   ./run.sh --clean      # stop + remove volumes (full reset)
#   ./run.sh --test       # run the test suite and doc quality check
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}  ▸  ${RESET}$*"; }
success() { echo -e "${GREEN}  ✓  ${RESET}$*"; }
warn()    { echo -e "${YELLOW}  ⚠  ${RESET}$*"; }
error()   { echo -e "${RED}  ✗  ${RESET}$*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}──── $* ────${RESET}"; }
die()     { error "$*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Background PID tracking ───────────────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  step "Shutting down"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      info "Stopping PID $pid"
      kill "$pid" 2>/dev/null || true
    fi
  done
  if [[ "${MODE:-dev}" == "dev" ]]; then
    info "Stopping Docker DB container"
    docker compose -f "$ROOT/docker-compose.yml" stop db 2>/dev/null || true
  fi
  success "All services stopped. Goodbye!"
}
trap cleanup SIGINT SIGTERM EXIT

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
  echo -e "${BOLD}${BLUE}"
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║       🏥  Doctor Appointment Booking System          ║"
  echo "  ║          Agentic SDLC Capstone — v1.0.0              ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# ── Argument parsing ──────────────────────────────────────────────────────────
MODE="dev"
for arg in "$@"; do
  case $arg in
    --docker) MODE="docker" ;;
    --stop)   MODE="stop" ;;
    --clean)  MODE="clean" ;;
    --test)   MODE="test" ;;
    --help|-h)
      echo "Usage: ./run.sh [--docker|--stop|--clean|--test]"
      echo "  (no flag)  Dev mode: Docker DB + native npm dev servers"
      echo "  --docker   Full Docker Compose stack"
      echo "  --stop     Stop all running services"
      echo "  --clean    Stop + remove volumes (full DB reset)"
      echo "  --test     Run Jest test suite + doc quality check"
      exit 0
      ;;
    *) die "Unknown flag: $arg. Run ./run.sh --help for usage." ;;
  esac
done

# ── Prerequisites check ───────────────────────────────────────────────────────
check_prereqs() {
  step "Checking prerequisites"

  local missing=0

  if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Download from https://nodejs.org (v20 LTS recommended)"
    missing=1
  else
    local node_ver
    node_ver=$(node --version | sed 's/v//' | cut -d. -f1)
    if [[ "$node_ver" -lt 18 ]]; then
      warn "Node.js v${node_ver} found — v18+ recommended"
    else
      success "Node.js $(node --version)"
    fi
  fi

  if ! command -v npm &>/dev/null; then
    error "npm is not installed (it usually comes with Node.js)"
    missing=1
  else
    success "npm $(npm --version)"
  fi

  if ! command -v docker &>/dev/null; then
    error "Docker is not installed. Download from https://docs.docker.com/get-docker/"
    missing=1
  else
    if ! docker info &>/dev/null; then
      error "Docker daemon is not running. Start Docker Desktop and retry."
      missing=1
    else
      success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    fi
  fi

  [[ $missing -eq 1 ]] && die "Missing prerequisites — install them and retry."
}

# ── .env setup ────────────────────────────────────────────────────────────────
setup_env() {
  step "Environment configuration"
  local env_file="$ROOT/.env"
  local example_file="$ROOT/.env.example"

  if [[ ! -f "$env_file" ]]; then
    info "Copying .env.example → .env"
    cp "$example_file" "$env_file"
  else
    success ".env already exists"
  fi

  # Generate RECEPTIONIST_PASSWORD_HASH if missing
  local current_hash
  current_hash=$(grep '^RECEPTIONIST_PASSWORD_HASH=' "$env_file" | cut -d= -f2-)
  if [[ -z "$current_hash" ]]; then
    info "Generating bcrypt hash for default password 'admin123'..."
    local hash
    hash=$(cd "$ROOT/backend" && node -e "
      require('bcrypt').hash('admin123', 10).then(h => process.stdout.write(h));
    " 2>/dev/null)
    if [[ -n "$hash" ]]; then
      # Replace the empty RECEPTIONIST_PASSWORD_HASH line
      sed -i.bak "s|^RECEPTIONIST_PASSWORD_HASH=.*|RECEPTIONIST_PASSWORD_HASH=${hash}|" "$env_file" && rm -f "${env_file}.bak"
      success "Password hash written to .env  (default login: receptionist / admin123)"
    else
      warn "Could not generate hash — install backend deps first, then re-run"
    fi
  else
    success "RECEPTIONIST_PASSWORD_HASH already set"
  fi
}

# ── Docker helpers ─────────────────────────────────────────────────────────────
start_db() {
  step "Starting PostgreSQL (Docker)"
  docker compose -f "$ROOT/docker-compose.yml" up -d db
  info "Waiting for PostgreSQL to be ready..."
  local retries=30
  until docker compose -f "$ROOT/docker-compose.yml" exec -T db \
      pg_isready -U postgres &>/dev/null; do
    ((retries--)) || die "PostgreSQL did not become ready after 30 attempts"
    sleep 1
    printf "."
  done
  echo ""
  success "PostgreSQL is ready"
}

# ── npm helpers ────────────────────────────────────────────────────────────────
install_deps() {
  step "Installing dependencies"

  if [[ ! -d "$ROOT/backend/node_modules" ]]; then
    info "Installing backend dependencies..."
    (cd "$ROOT/backend" && npm install --silent)
  else
    success "Backend node_modules already present (skip)"
  fi

  if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
    info "Installing frontend dependencies..."
    (cd "$ROOT/frontend" && npm install --silent)
  else
    success "Frontend node_modules already present (skip)"
  fi
}

# ── Database setup ─────────────────────────────────────────────────────────────
setup_database() {
  step "Database setup"
  local env_file="$ROOT/.env"

  info "Generating Prisma client..."
  (cd "$ROOT/backend" && npx prisma generate --schema=prisma/schema.prisma 2>/dev/null)

  info "Running migrations..."
  (cd "$ROOT/backend" && env $(grep -v '^#' "$env_file" | xargs) npx prisma migrate deploy 2>&1 \
    | grep -E 'Applying|already|sync|error' || true)

  info "Seeding database..."
  (cd "$ROOT/backend" && env $(grep -v '^#' "$env_file" | xargs) node prisma/seed.js 2>&1 \
    | grep -E '✓|Seeding|complete|error' || true)

  success "Database ready"
}

# ── Start services ─────────────────────────────────────────────────────────────
start_dev_services() {
  step "Starting application (dev mode)"
  local env_file="$ROOT/.env"

  info "Starting API server on port 4000..."
  (cd "$ROOT/backend" && env $(grep -v '^#' "$env_file" | xargs) npm run dev \
    >> "$ROOT/backend/api.log" 2>&1) &
  PIDS+=($!)
  success "API server started (PID ${PIDS[-1]}) — logs: backend/api.log"

  info "Starting frontend dev server on port 3000..."
  (cd "$ROOT/frontend" && npm run dev >> "$ROOT/frontend/frontend.log" 2>&1) &
  PIDS+=($!)
  success "Frontend started (PID ${PIDS[-1]}) — logs: frontend/frontend.log"

  # Wait for API to be ready
  info "Waiting for API to respond..."
  local retries=30
  until curl -sf http://localhost:4000/health &>/dev/null; do
    ((retries--)) || { warn "API did not respond — check backend/api.log"; break; }
    sleep 1
    printf "."
  done
  echo ""
}

start_docker_services() {
  step "Starting full Docker Compose stack"
  docker compose -f "$ROOT/docker-compose.yml" up --build -d
  success "All services started"
}

# ── Summary panel ──────────────────────────────────────────────────────────────
print_ready() {
  local mode=$1
  echo ""
  echo -e "${BOLD}${GREEN}"
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │               🚀  Application Ready                 │"
  echo "  ├─────────────────────────────────────────────────────┤"
  if [[ "$mode" == "docker" ]]; then
  echo "  │  Frontend  → http://localhost:3000                   │"
  echo "  │  API       → http://localhost:4000                   │"
  echo "  │  Mode      → Full Docker Compose                     │"
  else
  echo "  │  Frontend  → http://localhost:3000                   │"
  echo "  │  API       → http://localhost:4000                   │"
  echo "  │  Health    → http://localhost:4000/health            │"
  echo "  │  Mode      → Dev (Docker DB + native npm)            │"
  fi
  echo "  ├─────────────────────────────────────────────────────┤"
  echo "  │  Login     → receptionist / admin123                 │"
  echo "  ├─────────────────────────────────────────────────────┤"
  echo "  │  Logs      → backend/api.log  frontend/frontend.log  │"
  echo "  │  Stop      → Ctrl+C  or  ./run.sh --stop             │"
  echo "  └─────────────────────────────────────────────────────┘"
  echo -e "${RESET}"
}

# ── Mode: stop ─────────────────────────────────────────────────────────────────
do_stop() {
  step "Stopping all services"
  docker compose -f "$ROOT/docker-compose.yml" stop 2>/dev/null || true
  pkill -f "node src/server.js" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  success "All services stopped"
  exit 0
}

# ── Mode: clean ────────────────────────────────────────────────────────────────
do_clean() {
  step "Cleaning up (stop + remove volumes)"
  warn "This will DELETE all appointment data. Are you sure? [y/N]"
  read -r confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    docker compose -f "$ROOT/docker-compose.yml" down -v 2>/dev/null || true
    pkill -f "node src/server.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    success "Cleaned up — volumes removed"
  else
    info "Aborted"
  fi
  exit 0
}

# ── Mode: test ─────────────────────────────────────────────────────────────────
do_test() {
  step "Running verification suite"
  check_prereqs

  info "Starting test database..."
  docker compose -f "$ROOT/docker-compose.yml" up -d db
  sleep 3

  info "Running Jest test suite..."
  (cd "$ROOT/backend" && npm test)

  info "Running document quality check..."
  node "$ROOT/scripts/check-docs.js"

  success "All verification complete"
  docker compose -f "$ROOT/docker-compose.yml" stop db 2>/dev/null || true
  exit 0
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  print_banner

  case "$MODE" in
    stop)   do_stop ;;
    clean)  do_clean ;;
    test)   do_test ;;
    docker)
      check_prereqs
      setup_env
      start_docker_services
      print_ready "docker"
      echo -e "${DIM}  Press Ctrl+C to stop all containers${RESET}"
      # Keep script alive
      wait
      ;;
    dev|*)
      check_prereqs
      install_deps   # need npm for hash generation
      setup_env
      start_db
      setup_database
      start_dev_services
      print_ready "dev"
      echo -e "${DIM}  Press Ctrl+C to stop all services${RESET}"
      # Keep script alive — wait for background processes
      wait "${PIDS[@]}"
      ;;
  esac
}

main
