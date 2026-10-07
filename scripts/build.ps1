# =============================================================================
# scripts/build.ps1 -- Local build and deployment helper (Windows PowerShell)
# =============================================================================
# Usage:
#   .\scripts\build.ps1 [dev|prod|down|logs|seed|status]
#
# Commands:
#   dev     Build and start all services in development mode (default)
#   prod    Build and start all services in production mode
#   down    Stop and remove all containers (volumes are preserved)
#   logs    Tail logs for all services
#   seed    Run the Prisma seed against the running API container
#   status  Show container health and port bindings
# =============================================================================

param(
  [string]$Command = 'dev'
)

$ComposeFile         = 'docker-compose.yml'
$ComposeProdOverride = 'docker-compose.prod.yml'
$ProjectName         = 'codemie-meetingnotes'

function Check-Env {
  if (-not (Test-Path '.env')) {
    Write-Error '[ERROR] .env file not found. Copy .env.example to .env and fill in values.'
    exit 1
  }
}

switch ($Command) {
  'dev' {
    Check-Env
    Write-Host '[build.ps1] Starting in DEVELOPMENT mode...'
    docker compose -p $ProjectName -f $ComposeFile up --build
  }
  'prod' {
    Check-Env
    Write-Host '[build.ps1] Starting in PRODUCTION mode...'
    docker compose -p $ProjectName -f $ComposeFile -f $ComposeProdOverride up --build -d
    Write-Host '[build.ps1] Services started. Run: .\scripts\build.ps1 status'
  }
  'down' {
    Write-Host '[build.ps1] Stopping all containers...'
    docker compose -p $ProjectName down
  }
  'logs' {
    docker compose -p $ProjectName logs -f
  }
  'seed' {
    Write-Host '[build.ps1] Running Prisma seed...'
    docker compose -p $ProjectName exec api node prisma/seed.js
  }
  'status' {
    docker compose -p $ProjectName ps
  }
  default {
    Write-Error "Unknown command: $Command"
    Write-Host 'Usage: .\scripts\build.ps1 [dev|prod|down|logs|seed|status]'
    exit 1
  }
}
