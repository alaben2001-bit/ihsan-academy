@echo off
setlocal
cd /d "%~dp0"
set NODE_SKIP_PLATFORM_CHECK=1
node server/server.js
if errorlevel 1 pause
