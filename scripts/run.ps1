#Requires -Version 5.1
<#
.SYNOPSIS
    Doctor Appointment Booking System - start/stop script

.DESCRIPTION
    Starts the application in development mode (Docker DB + native npm processes)
    or in full Docker Compose mode.

.PARAMETER Docker
    Start the full Docker Compose stack (db + api + frontend).

.PARAMETER Stop
    Stop all running services.

.PARAMETER Clean
    Stop all services and remove Docker volumes (full database reset).

.PARAMETER Test
    Run the Jest test suite and the document quality check.

.EXAMPLE
    .\run.ps1              # Dev mode: Docker DB + npm dev servers
    .\run.ps1 -Docker      # Full Docker Compose stack
    .\run.ps1 -Stop        # Stop all running services
    .\run.ps1 -Clean       # Stop + remove volumes
    .\run.ps1 -Test        # Run verification suite
#>
param(
    [switch]$Docker,
    [switch]$Stop,
    [switch]$Clean,
    [switch]$Test
)

$ErrorActionPreference = 'Continue'

# ── Paths ──────────────────────────────────────────────────────────────────────
$Root       = Split-Path $PSScriptRoot -Parent   # project root (parent of scripts/)
$EnvFile    = Join-Path $Root '.env'
$EnvExample = Join-Path $Root '.env.example'
$Compose    = Join-Path $Root 'docker-compose.yml'
$Backend    = Join-Path $Root 'backend'
$Frontend   = Join-Path $Root 'frontend'
$Scripts    = Join-Path $Root 'scripts'

# ── Background job tracking ────────────────────────────────────────────────────
$script:Jobs = [System.Collections.ArrayList]@()

# ── Output helpers ─────────────────────────────────────────────────────────────
function Write-Info {
    param([string]$Msg)
    Write-Host '  > ' -ForegroundColor Cyan -NoNewline
    Write-Host $Msg
}
function Write-Success {
    param([string]$Msg)
    Write-Host '  v ' -ForegroundColor Green -NoNewline
    Write-Host $Msg
}
function Write-Warn {
    param([string]$Msg)
    Write-Host '  ! ' -ForegroundColor Yellow -NoNewline
    Write-Host $Msg
}
function Write-Fail {
    param([string]$Msg)
    Write-Host '  x ' -ForegroundColor Red -NoNewline
    Write-Host $Msg
}
function Write-Step {
    param([string]$Msg)
    Write-Host ''
    Write-Host "---- $Msg ----" -ForegroundColor Cyan
}
function Write-Fatal {
    param([string]$Msg)
    Write-Fail $Msg
    exit 1
}

# ── Banner ─────────────────────────────────────────────────────────────────────
function Show-Banner {
    Write-Host ''
    Write-Host '  +======================================================+' -ForegroundColor Blue
    Write-Host '  |      Doctor Appointment Booking System               |' -ForegroundColor Blue
    Write-Host '  |         Agentic SDLC Capstone  -  v1.0.0             |' -ForegroundColor Blue
    Write-Host '  +======================================================+' -ForegroundColor Blue
    Write-Host ''
}

# ── Cleanup ────────────────────────────────────────────────────────────────────
function Invoke-Cleanup {
    Write-Step 'Shutting down'

    foreach ($job in $script:Jobs) {
        if ($null -ne $job) {
            $j = Get-Job -Id $job.Id -ErrorAction SilentlyContinue
            if ($null -ne $j) {
                Write-Info "Stopping job: $($job.Name)"
                $job | Stop-Job -ErrorAction SilentlyContinue
                $job | Remove-Job -ErrorAction SilentlyContinue
            }
        }
    }

    # Kill orphaned node processes
    $nodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcs) {
        $nodeProcs | ForEach-Object {
            Write-Info "Stopping process PID $($_.Id)"
            $_ | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    }

    # Stop Docker DB
    Write-Info 'Stopping Docker DB container...'
    $null = docker compose -f $Compose stop db 2>&1
    Write-Success 'All services stopped. Goodbye!'
}

# ── Prerequisites ──────────────────────────────────────────────────────────────
function Test-Prerequisites {
    Write-Step 'Checking prerequisites'
    $ok = $true

    # Node.js
    try {
        $rawVer = node --version 2>&1
        $major = [int]($rawVer.ToString().TrimStart('v').Split('.')[0])
        if ($major -lt 18) {
            Write-Warn "Node.js $rawVer detected - v18+ recommended"
        } else {
            Write-Success "Node.js $rawVer"
        }
    } catch {
        Write-Fail 'Node.js not found. Download from https://nodejs.org (v20 LTS)'
        $ok = $false
    }

    # npm
    try {
        $npmVer = npm --version 2>&1
        Write-Success "npm $npmVer"
    } catch {
        Write-Fail 'npm not found (usually bundled with Node.js)'
        $ok = $false
    }

    # Docker
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -ne 0) { throw 'Docker daemon not running' }
        $dockerRaw = docker --version 2>&1
        Write-Success "Docker $dockerRaw"
    } catch {
        Write-Fail 'Docker is not running. Start Docker Desktop and retry.'
        $ok = $false
    }

    if (-not $ok) {
        Write-Fatal 'Missing prerequisites - install them and retry.'
    }
}

# ── .env setup ─────────────────────────────────────────────────────────────────
function Initialize-EnvFile {
    Write-Step 'Environment configuration'

    if (-not (Test-Path $EnvFile)) {
        Write-Info 'Copying .env.example -> .env'
        Copy-Item $EnvExample $EnvFile
    } else {
        Write-Success '.env already exists'
    }

    # Check if RECEPTIONIST_PASSWORD_HASH is set
    $content = Get-Content $EnvFile -Raw
    $match = [regex]::Match($content, 'RECEPTIONIST_PASSWORD_HASH=(.*)')
    $currentHash = ''
    if ($match.Success) {
        $currentHash = $match.Groups[1].Value.Trim()
    }

    if ([string]::IsNullOrEmpty($currentHash)) {
        Write-Info "Generating bcrypt hash for default password 'admin123'..."
        Push-Location $Backend
        try {
            $hash = node -e "require('bcrypt').hash('admin123',10).then(function(h){process.stdout.write(h)})" 2>&1
            if ($hash -and $hash.ToString().StartsWith('$2b$')) {
                $escaped = $hash.ToString().Replace('\', '\\')
                $content = $content -replace 'RECEPTIONIST_PASSWORD_HASH=.*', "RECEPTIONIST_PASSWORD_HASH=$escaped"
                [System.IO.File]::WriteAllText($EnvFile, $content, [System.Text.Encoding]::UTF8)
                Write-Success "Password hash written to .env  (login: receptionist / admin123)"
            } else {
                Write-Warn 'Could not generate hash now - re-run after deps are installed'
            }
        } catch {
            Write-Warn "Hash generation failed: $_"
        } finally {
            Pop-Location
        }
    } else {
        Write-Success 'RECEPTIONIST_PASSWORD_HASH already set'
    }
}

# ── Load .env into current process ─────────────────────────────────────────────
function Import-EnvFile {
    if (-not (Test-Path $EnvFile)) { return }
    $lines = Get-Content $EnvFile
    foreach ($line in $lines) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $idx = $line.IndexOf('=')
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        if ($key -and -not [System.Environment]::GetEnvironmentVariable($key)) {
            [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
        }
    }
}

# ── Start PostgreSQL ────────────────────────────────────────────────────────────
function Start-Database {
    Write-Step 'Starting PostgreSQL (Docker)'
    $null = docker compose -f $Compose up -d db 2>&1
    Write-Info 'Waiting for PostgreSQL to be ready...'
    $retries = 30
    do {
        $null = docker compose -f $Compose exec -T db pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) { break }
        $retries--
        if ($retries -le 0) { Write-Fatal 'PostgreSQL did not become ready after 30 attempts' }
        Start-Sleep -Seconds 1
        Write-Host '.' -NoNewline
    } while ($true)
    Write-Host ''
    Write-Success 'PostgreSQL is ready'
}

# ── Install npm dependencies ───────────────────────────────────────────────────
function Install-Dependencies {
    Write-Step 'Installing dependencies'

    $backendModules = Join-Path $Backend 'node_modules'
    if (-not (Test-Path $backendModules)) {
        Write-Info 'Installing backend dependencies...'
        Push-Location $Backend
        try {
            npm install --silent
        } finally {
            Pop-Location
        }
    } else {
        Write-Success 'Backend node_modules already present (skip)'
    }

    $frontendModules = Join-Path $Frontend 'node_modules'
    if (-not (Test-Path $frontendModules)) {
        Write-Info 'Installing frontend dependencies...'
        Push-Location $Frontend
        try {
            npm install --silent
        } finally {
            Pop-Location
        }
    } else {
        Write-Success 'Frontend node_modules already present (skip)'
    }
}

# ── Database migration + seed ──────────────────────────────────────────────────
function Initialize-Database {
    Write-Step 'Database setup'
    Import-EnvFile

    Push-Location $Backend
    try {
        Write-Info 'Generating Prisma client...'
        $null = npx prisma generate --schema=prisma/schema.prisma 2>&1

        Write-Info 'Running migrations...'
        $migrateOut = npx prisma migrate deploy 2>&1
        $migrateOut | Select-String -Pattern 'Applying|sync|already' | ForEach-Object {
            Write-Host "    $_"
        }

        Write-Info 'Seeding database...'
        $seedOut = node prisma/seed.js 2>&1
        $seedOut | Select-String -Pattern 'Seeding|complete|v ' | ForEach-Object {
            Write-Host "    $_"
        }
    } finally {
        Pop-Location
    }
    Write-Success 'Database ready'
}

# ── Start dev services ──────────────────────────────────────────────────────────
function Start-DevServices {
    Write-Step 'Starting application (dev mode)'
    Import-EnvFile

    $apiLog      = Join-Path $Backend  'api.log'
    $frontendLog = Join-Path $Frontend 'frontend.log'

    # Load env vars for the job
    $envVars = @{}
    if (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
            $idx = $_.IndexOf('=')
            $k = $_.Substring(0, $idx).Trim()
            $v = $_.Substring($idx + 1).Trim()
            if ($k) { $envVars[$k] = $v }
        }
    }

    Write-Info 'Starting API server on port 4000...'
    $apiJob = Start-Job -Name 'ApiServer' -ScriptBlock {
        param($Dir, $Log, $Vars)
        Set-Location $Dir
        foreach ($kv in $Vars.GetEnumerator()) {
            [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, 'Process')
        }
        npm run dev *>&1 | Tee-Object -FilePath $Log
    } -ArgumentList $Backend, $apiLog, $envVars

    $null = $script:Jobs.Add($apiJob)
    Write-Success "API server starting (Job: $($apiJob.Name))  logs: backend\api.log"

    Write-Info 'Starting frontend dev server on port 3000...'
    $frontJob = Start-Job -Name 'FrontendServer' -ScriptBlock {
        param($Dir, $Log)
        Set-Location $Dir
        npm run dev *>&1 | Tee-Object -FilePath $Log
    } -ArgumentList $Frontend, $frontendLog

    $null = $script:Jobs.Add($frontJob)
    Write-Success "Frontend starting (Job: $($frontJob.Name))  logs: frontend\frontend.log"

    # Wait for API to respond
    Write-Info 'Waiting for API to respond...'
    $retries = 40
    do {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -Uri 'http://localhost:4000/health' `
                -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) { break }
        } catch {
            # not ready yet
        }
        $retries--
        Write-Host '.' -NoNewline
        if ($retries -le 0) {
            Write-Host ''
            Write-Warn 'API did not respond - check backend\api.log'
            break
        }
    } while ($true)
    Write-Host ''
}

# ── Start full Docker stack ────────────────────────────────────────────────────
function Start-DockerServices {
    Write-Step 'Starting full Docker Compose stack'
    docker compose -f $Compose up --build -d
    Write-Success 'All containers started'
}

# ── Ready panel ────────────────────────────────────────────────────────────────
function Show-ReadyPanel {
    param([string]$Mode)
    Write-Host ''
    Write-Host '  +-----------------------------------------------------+' -ForegroundColor Green
    Write-Host '  =   Application Ready                                 =' -ForegroundColor Green
    Write-Host '  +-----------------------------------------------------+' -ForegroundColor Green
    Write-Host '  Frontend  ->  http://localhost:3000' -ForegroundColor Green
    Write-Host '  API       ->  http://localhost:4000' -ForegroundColor Green
    if ($Mode -ne 'docker') {
        Write-Host '  Health    ->  http://localhost:4000/health' -ForegroundColor Green
    }
    Write-Host "  Mode      ->  $Mode" -ForegroundColor Green
    Write-Host '  +-----------------------------------------------------+' -ForegroundColor Green
    Write-Host '  Login     ->  receptionist / admin123' -ForegroundColor Green
    Write-Host '  +-----------------------------------------------------+' -ForegroundColor Green
    Write-Host '  Logs: backend\api.log  and  frontend\frontend.log' -ForegroundColor Green
    Write-Host '  Stop: Ctrl+C  or  .\run.ps1 -Stop' -ForegroundColor Green
    Write-Host '  +-----------------------------------------------------+' -ForegroundColor Green
    Write-Host ''

    # Open browser
    try { Start-Process 'http://localhost:3000' } catch { }
}

# ── Mode: -Stop ────────────────────────────────────────────────────────────────
function Invoke-Stop {
    Write-Step 'Stopping all services'
    $null = docker compose -f $Compose stop 2>&1
    Get-Process -Name node -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Job | Stop-Job  -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Write-Success 'All services stopped'
    exit 0
}

# ── Mode: -Clean ───────────────────────────────────────────────────────────────
function Invoke-Clean {
    Write-Step 'Clean up (stop + remove volumes)'
    Write-Warn 'This will DELETE all appointment data. Are you sure? [y/N]'
    $confirm = Read-Host
    if ($confirm -match '^[Yy]$') {
        $null = docker compose -f $Compose down -v 2>&1
        Get-Process -Name node -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue
        Get-Job | Stop-Job  -ErrorAction SilentlyContinue
        Get-Job | Remove-Job -ErrorAction SilentlyContinue
        Write-Success 'Cleaned - volumes removed'
    } else {
        Write-Info 'Aborted'
    }
    exit 0
}

# ── Mode: -Test ────────────────────────────────────────────────────────────────
function Invoke-Test {
    Write-Step 'Running verification suite'
    Test-Prerequisites

    Write-Info 'Starting test database...'
    $null = docker compose -f $Compose up -d db 2>&1
    Start-Sleep -Seconds 3

    Write-Info 'Running Jest test suite...'
    Push-Location $Backend
    try {
        npm test
    } finally {
        Pop-Location
    }

    Write-Info 'Running document quality check...'
    $checkScript = Join-Path $Scripts 'check-docs.js'
    node $checkScript

    Write-Success 'All verification complete'
    $null = docker compose -f $Compose stop db 2>&1
    exit 0
}

# ── Main ───────────────────────────────────────────────────────────────────────
Show-Banner

if ($Stop)  { Invoke-Stop }
if ($Clean) { Invoke-Clean }
if ($Test)  { Invoke-Test }

if ($Docker) {
    Test-Prerequisites
    Initialize-EnvFile
    Start-DockerServices
    Show-ReadyPanel -Mode 'docker'
    Write-Host '  Press Ctrl+C to stop all containers' -ForegroundColor DarkGray

    try {
        while ($true) {
            Start-Sleep -Seconds 5
            $running = docker compose -f $Compose ps --services --filter status=running 2>&1
            if ([string]::IsNullOrEmpty($running)) {
                Write-Warn 'All containers have stopped.'
                break
            }
        }
    } finally {
        Invoke-Cleanup
    }
} else {
    # Default: dev mode
    Test-Prerequisites
    Install-Dependencies
    Initialize-EnvFile
    Start-Database
    Initialize-Database
    Start-DevServices
    Show-ReadyPanel -Mode 'dev'
    Write-Host '  Press Ctrl+C to stop all services' -ForegroundColor DarkGray

    try {
        while ($true) {
            Start-Sleep -Seconds 5
            $alive = $script:Jobs | Where-Object { $null -ne $_ -and $_.State -eq 'Running' }
            if ($alive.Count -eq 0) {
                Write-Warn 'All background jobs have exited - check logs for errors'
                break
            }
        }
    } finally {
        Invoke-Cleanup
    }
}
