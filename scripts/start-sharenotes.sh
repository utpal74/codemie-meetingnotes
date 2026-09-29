#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [[ ! -x "$BACKEND/node_modules/.bin/nest" ]]; then
  echo "Backend dependencies are missing. Run: (cd backend && npm install)" >&2
  exit 1
fi

if [[ ! -x "$FRONTEND/node_modules/.bin/vite" ]]; then
  echo "Frontend dependencies are missing. Run: (cd frontend && npm install)" >&2
  exit 1
fi

echo "Starting ShareNotes backend on http://localhost:3000 ..."
(cd "$BACKEND" && ./node_modules/.bin/nest start --watch --host 0.0.0.0 --port 3000) &
BACKEND_PID=$!

echo "Starting ShareNotes frontend on http://localhost:5173 ..."
(cd "$FRONTEND" && ./node_modules/.bin/vite --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "ShareNotes is running. Press Ctrl+C to stop both services."
echo "Frontend: http://localhost:5173/"
echo "API:      http://localhost:3000/api/v1/notes"
wait