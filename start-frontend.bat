@echo off
REM PortFlow AI – Start Frontend (Windows CMD)
cd /d "%~dp0frontend"

where npm >nul 2>&1 || (echo ERROR: npm not found. Install Node.js from https://nodejs.org && exit /b 1)

if not exist "node_modules" (
    echo Installing npm packages...
    npm install
)

echo.
echo ========================================
echo   PortFlow AI Frontend starting...
echo   URL: http://localhost:5173
echo ========================================
echo.

npm run dev
