# PortFlow AI – Start Backend (PowerShell)
Set-Location "$PSScriptRoot\backend"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& ".venv\Scripts\Activate.ps1"

Write-Host "Installing dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt --quiet

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  PortFlow AI Backend starting..." -ForegroundColor Green
Write-Host "  API: http://localhost:8000" -ForegroundColor Green
Write-Host "  Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
