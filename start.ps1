# Starts the backend (port 8000) and frontend (port 3000) in two new PowerShell windows.
# Creates the Python environment on first run and installs any dependencies added since the last run.

$root = $PSScriptRoot

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

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; node node_modules\next\dist\bin\next dev --port 3000"

Write-Host "Backend:  http://localhost:8000/docs"
Write-Host "Frontend: http://localhost:3000  (open this one)"
