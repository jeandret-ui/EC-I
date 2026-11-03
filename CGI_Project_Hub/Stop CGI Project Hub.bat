@echo off
cd /d "%~dp0"
if exist "runtime\python.exe" ( "runtime\python.exe" hub.py --stop ) else ( python hub.py --stop )
timeout /t 3 >nul
