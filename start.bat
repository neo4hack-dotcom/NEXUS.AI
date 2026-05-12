@echo off
REM ==========================================================
REM  NEXUS.AI - Production launcher (Windows)
REM  Boots FastAPI which serves both the API and the built UI.
REM  Opens the browser automatically.
REM ==========================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Virtual environment not found.
  echo         Run install.bat first.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo [INFO] Production bundle missing - building it now.
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
)

echo.
echo ============================================================
echo   NEXUS.AI - Starting...
echo   URL : http://localhost:3001
echo ============================================================
echo.

start "" "http://localhost:3001"
".venv\Scripts\python.exe" server.py

endlocal
