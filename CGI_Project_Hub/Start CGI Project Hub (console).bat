@echo off
setlocal
cd /d "%~dp0"
title CGI Project Hub
rem Same as the desktop shortcut, but keeps a console window open so you can see messages.
if exist "runtime\python.exe" (
  "runtime\python.exe" hub.py %*
  goto done
)
where py >nul 2>nul && ( py -3 hub.py %* & goto done )
where python >nul 2>nul && ( python hub.py %* & goto done )
echo Python was not found and the bundled runtime folder is missing.
echo Re-extract the whole ZIP (including the runtime folder), or install Python 3.10+ from python.org.
:done
echo.
pause
