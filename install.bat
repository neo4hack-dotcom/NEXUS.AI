@echo off
REM ==========================================================
REM  NEXUS.AI - Windows one-shot installer
REM  - Checks Node.js and Python
REM  - Installs npm dependencies
REM  - Creates a Python virtualenv and installs FastAPI
REM  - Builds the frontend
REM  - Offers to create a desktop shortcut
REM ==========================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "ESC="
echo.
echo ============================================================
echo   NEXUS.AI - Installer
echo ============================================================
echo.

REM ------- Check Node.js -------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install Node.js 20+ from https://nodejs.org/
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo [OK]    Node.js detected: !NODE_VERSION!

REM ------- Check Python -------
set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 (
  py -3 --version >nul 2>nul
  if not errorlevel 1 set "PY_CMD=py -3"
)
if "!PY_CMD!"=="" (
  where python >nul 2>nul
  if not errorlevel 1 set "PY_CMD=python"
)
if "!PY_CMD!"=="" (
  echo [ERROR] Python 3.10+ was not found on PATH.
  echo         Install Python from https://www.python.org/downloads/
  echo         and tick "Add python.exe to PATH" during setup.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('!PY_CMD! --version') do set "PYTHON_VERSION=%%v"
echo [OK]    Python detected: !PYTHON_VERSION! (command: !PY_CMD!)

echo.
echo ------------------------------------------------------------
echo   Step 1/4  Installing npm dependencies
echo ------------------------------------------------------------
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo ------------------------------------------------------------
echo   Step 2/4  Creating Python virtual environment (.venv)
echo ------------------------------------------------------------
if not exist ".venv" (
  !PY_CMD! -m venv .venv
  if errorlevel 1 (
    echo [ERROR] venv creation failed.
    pause
    exit /b 1
  )
)
call ".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
call ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed.
  pause
  exit /b 1
)

echo.
echo ------------------------------------------------------------
echo   Step 3/4  Building production frontend bundle
echo ------------------------------------------------------------
call npm run build
if errorlevel 1 (
  echo [ERROR] Vite build failed.
  pause
  exit /b 1
)

echo.
echo ------------------------------------------------------------
echo   Step 4/4  Desktop shortcut
echo ------------------------------------------------------------
choice /M "Create a desktop shortcut to launch NEXUS.AI"
if errorlevel 2 goto :skip_shortcut
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Create-Shortcut.ps1"
:skip_shortcut

echo.
echo ============================================================
echo   Install complete.
echo.
echo   To start NEXUS.AI:       start.bat
echo   Or in development mode:  start-dev.bat
echo ============================================================
echo.
pause
endlocal
