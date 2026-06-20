@echo off
title AssetVault
cd /d "%~dp0"

echo ========================================
echo   AssetVault Desktop
echo ========================================

REM Build if needed
if not exist ".next\BUILD_ID" (
    echo Building...
    call cmd /c "npm run build"
)

REM Start server if needed
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo Starting server...
    start "AV-Server" /min cmd /c "npm run start"
    timeout /t 4 >nul
)

REM Launch Electron (desktop window)
set ELC=node_modules\.bin\electron.cmd
if exist "%ELC%" (
    start "" "%ELC%" . --no-sandbox --disable-gpu-cache
) else (
    start "" npx electron . --no-sandbox --disable-gpu-cache
)
