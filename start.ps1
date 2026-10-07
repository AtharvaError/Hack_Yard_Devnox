# Starts the backend and frontend in two new PowerShell windows.
# Creates the Python environment on first run and installs any dependencies added since the last run.
#
#   .\start.ps1                              backend on 8000, frontend on 3000
#   .\start.ps1 -ApiPort 8100 -WebPort 3100  use other ports when those are taken by another project

param(
    [int]$ApiPort = 8000,
    [int]$WebPort = 3000
)

$root = $PSScriptRoot

foreach ($port in $ApiPort, $WebPort) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "Port $port is already in use by another program." -ForegroundColor Yellow
        Write-Host "Try:  .\start.ps1 -ApiPort 8100 -WebPort 3100"
        exit 1
    }
}

if (-not (Test-Path "$root\backend\.venv")) {
    Write-Host "Setting up the Python environment (first run only)..."
    py -3.12 -m venv "$root\backend\.venv"
}
# Quick when everything is already installed; picks up packages added by an update.
& "$root\backend\.venv\Scripts\python.exe" -m pip install -q --disable-pip-version-check -r "$root\backend\requirements.txt"

$installed = "$root\frontend\node_modules\.package-lock.json"
$wanted = "$root\frontend\package-lock.json"
if (-not (Test-Path $installed) -or (Get-Item $wanted).LastWriteTime -gt (Get-Item $installed).LastWriteTime) {
    Write-Host "Installing frontend packages..."
    Push-Location "$root\frontend"
    npm install
    Pop-Location
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port $ApiPort"
# NEXT_PUBLIC_API_PORT tells the frontend which port the backend is on.
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:NEXT_PUBLIC_API_PORT = '$ApiPort'; Set-Location '$root\frontend'; node node_modules\next\dist\bin\next dev --port $WebPort"

Write-Host "Backend:  http://localhost:$ApiPort/docs"
Write-Host "Frontend: http://localhost:$WebPort  (open this one)"
