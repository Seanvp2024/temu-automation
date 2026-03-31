@echo off
setlocal

set "APP_DIR=C:\Users\Administrator\temu-automation\release-repack\win-unpacked"
set "APP_EXE="

for %%I in ("%APP_DIR%\*.exe") do (
  set "APP_EXE=%%~fI"
  goto :found
)

echo Desktop executable not found under:
echo %APP_DIR%
exit /b 1

:found
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%APP_EXE%'"

endlocal
