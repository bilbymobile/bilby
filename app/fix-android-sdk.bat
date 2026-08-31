@echo off
REM ==========================================================================
REM  Bilby - one-click Android SDK fix
REM
REM  Fixes:  "cmdline-tools component is missing"
REM          "Android license status unknown"
REM
REM  Just double-click this file. No admin rights needed.
REM
REM  This .bat is only a launcher - the work happens in fix-android-sdk.ps1
REM  next to it. PowerShell is used because batch cannot parse XML, follow
REM  redirects, or set user environment variables reliably.
REM ==========================================================================

setlocal
cd /d "%~dp0"

if not exist "%~dp0fix-android-sdk.ps1" (
  echo.
  echo   ERROR: fix-android-sdk.ps1 was not found next to this file.
  echo   Keep both files together in the same folder.
  echo.
  pause
  exit /b 1
)

REM -NoProfile keeps a slow or broken PowerShell profile out of the way.
REM -ExecutionPolicy Bypass applies to this process only - it does not change
REM any machine setting.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-android-sdk.ps1"

endlocal
