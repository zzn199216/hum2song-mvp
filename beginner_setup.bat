@echo off
setlocal
cd /d "%~dp0"

REM After first setup, venv exists — reuse it so installs land in the same env as beginner_launch.bat
if exist "%~dp0venv\Scripts\python.exe" (
  echo [Hum2Song] Using project venv: "%~dp0venv\Scripts\python.exe"
  "%~dp0venv\Scripts\python.exe" "%~dp0scripts\beginner_setup.py" %*
  exit /b %ERRORLEVEL%
)

set "PY_CMD="
where python >nul 2>&1
if not errorlevel 1 set "PY_CMD=python"
if not defined PY_CMD (
  where py >nul 2>&1
  if not errorlevel 1 set "PY_CMD=py"
)
if not defined PY_CMD (
  echo.
  echo [Hum2Song] Could not find "python" or "py" on your PATH.
  echo Install Python 3.11+ from https://www.python.org/downloads/ ^(Windows installer^)
  echo and enable "Add python.exe to PATH", then open a new Command Prompt and try again.
  echo.
  exit /b 1
)

%PY_CMD% scripts\beginner_setup.py %*
exit /b %ERRORLEVEL%
