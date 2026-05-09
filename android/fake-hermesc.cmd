@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "OUT_FILE="
set "INPUT_FILE="

:parse_args
if "%~1"=="" goto after_parse
if /I "%~1"=="-out" (
  set "OUT_FILE=%~2"
  shift
  shift
  goto parse_args
)

if not defined INPUT_FILE (
  if exist "%~1" (
    set "INPUT_FILE=%~1"
  )
)

shift
goto parse_args

:after_parse
if not defined OUT_FILE (
  echo fake-hermesc: missing -out argument 1>&2
  exit /b 1
)

if not defined INPUT_FILE (
  echo fake-hermesc: missing input bundle argument 1>&2
  exit /b 1
)

copy /Y "%INPUT_FILE%" "%OUT_FILE%" >nul
if errorlevel 1 (
  echo fake-hermesc: failed to copy "%INPUT_FILE%" to "%OUT_FILE%" 1>&2
  exit /b 1
)

exit /b 0
