@echo off
rem Double-click to start the Shir Chadash site + back office on this computer.
rem Keep this window open while using the site. Close it to stop the server.
cd /d "%~dp0"
start "" "http://localhost:8765/admin"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8765
pause
