@echo off
setlocal
if exist "%~dp0CursorZhCNTool.exe" (
  start "" "%~dp0CursorZhCNTool.exe"
  exit /b 0
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0CursorZhCN.ps1"
endlocal
