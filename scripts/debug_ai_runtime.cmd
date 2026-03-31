@echo off
setlocal

set "NODE_EXE=C:\Users\Administrator\temu-automation\release\win-unpacked\resources\node-runtime\node.exe"
set "BOOTSTRAP=C:\Users\Administrator\temu-automation\release\win-unpacked\resources\auto-image-gen-runtime\bootstrap.cjs"
set "LOG=C:\Users\Administrator\AppData\Roaming\temu-automation\ai-runtime-manual.log"
set "PORT=3210"
set "HOSTNAME=127.0.0.1"
set "NODE_ENV=production"

if not exist "%NODE_EXE%" (
  echo node runtime not found: %NODE_EXE%
  exit /b 1
)

if not exist "%BOOTSTRAP%" (
  echo bootstrap not found: %BOOTSTRAP%
  exit /b 1
)

echo Starting AI runtime...
(
  echo PORT=%PORT%
  echo HOSTNAME=%HOSTNAME%
  echo NODE_ENV=%NODE_ENV%
  echo BOOTSTRAP=%BOOTSTRAP%
) > "%LOG%"
"%NODE_EXE%" "%BOOTSTRAP%" >> "%LOG%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
echo Exit code: %EXIT_CODE%
echo Log file: %LOG%
exit /b %EXIT_CODE%
