$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $backend 'node_modules\.bin\nest.cmd'))) {
    throw 'Backend dependencies are missing. Run: Push-Location backend; npm install'
}

if (-not (Test-Path (Join-Path $frontend 'node_modules\.bin\vite.cmd'))) {
    throw 'Frontend dependencies are missing. Run: Push-Location frontend; npm install'
}

Write-Host 'Starting ShareNotes backend on http://localhost:3000 ...' -ForegroundColor Green
Start-Process -FilePath (Join-Path $backend 'node_modules\.bin\nest.cmd') `
    -ArgumentList 'start', '--watch', '--host', '0.0.0.0', '--port', '3000' `
    -WorkingDirectory $backend

Write-Host 'Starting ShareNotes frontend on http://localhost:5173 ...' -ForegroundColor Green
Start-Process -FilePath (Join-Path $frontend 'node_modules\.bin\vite.cmd') `
    -ArgumentList '--host', '0.0.0.0', '--port', '5173' `
    -WorkingDirectory $frontend

Write-Host ''
Write-Host 'ShareNotes is starting.' -ForegroundColor Cyan
Write-Host 'Frontend: http://localhost:5173/'
Write-Host 'API:      http://localhost:3000/api/v1/notes'
Write-Host 'Close the two Node.js windows to stop the services.' -ForegroundColor DarkGray