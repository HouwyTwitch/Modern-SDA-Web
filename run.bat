@echo off
rem Modern SDA Web - Windows launcher. Double-click to run.
setlocal
cd /d "%~dp0"
title Modern SDA Web

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  echo.
  echo   Python 3.10 or newer is required but was not found.
  echo   Install it from:  https://www.python.org/downloads/
  echo   IMPORTANT: tick "Add Python to PATH" during installation.
  echo.
  pause
  exit /b 1
)

%PY% scripts\launch.py %*

echo.
echo   Modern SDA Web has stopped.
pause
