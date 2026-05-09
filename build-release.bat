@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-release.ps1"
if errorlevel 1 (
  echo.
  echo TinyMD release build failed.
  pause
  exit /b 1
)
echo.
echo TinyMD release build finished.
pause
