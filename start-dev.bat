@echo off
REM ==========================================================
REM  NEXUS.AI - Development launcher (Windows)
REM  Opens two terminals:
REM    1) FastAPI on http://localhost:3001
REM    2) Vite HMR  on http://localhost:3000  (with /api proxy)
REM ==========================================================
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Virtual environment not found. Run install.bat first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERROR] node_modules not found. Run install.bat first.
  pause
  exit /b 1
)

echo Starting backend in a new window...
start "NEXUS.AI API" cmd /k ".venv\Scripts\python.exe server.py"

REM Give uvicorn a moment to bind the port
timeout /t 2 /nobreak >nul

echo Starting frontend (Vite) in a new window...
start "NEXUS.AI Frontend" cmd /k "npm run dev"

REM Give Vite a moment to compile and bind
timeout /t 4 /nobreak >nul

start "" "http://localhost:3000"

echo.
echo NEXUS.AI dev mode running.
echo   Frontend : http://localhost:3000
echo   API      : http://localhost:3001
echo Close the two opened terminals to stop the servers.
echo.
endlocal
