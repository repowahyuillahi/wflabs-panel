@echo off
setlocal EnableDelayedExpansion
title WFLabs Panel Launcher
cd /d "%~dp0"

set PANEL_PORT=20110
set PANEL_HOST=0.0.0.0
set MODE=%1

for /f %%i in ('tailscale ip -4 2^>nul') do set TAIL_IP=%%i
if not defined TAIL_IP set TAIL_IP=100.96.147.47

echo ========================================
echo  WFLabs 9Router Panel Launcher
echo ========================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js tidak ditemukan di PATH.
  echo Install Node.js LTS ^>= 22.5 lalu coba lagi.
  if not "%MODE%"=="--autostart" pause
  exit /b 1
)

if not exist "%~dp0server.js" (
  echo [ERROR] server.js tidak ditemukan di %~dp0
  if not "%MODE%"=="--autostart" pause
  exit /b 1
)

netstat -ano | findstr ":%PANEL_PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [OK] Panel sudah jalan di port %PANEL_PORT%.
  goto :SHOWURLS
)

echo [..] Menjalankan node server.js ...
set PANEL_HOST=%PANEL_HOST%
set PANEL_PORT=%PANEL_PORT%
start "WFLabs-Panel-20110" /min node.exe server.js
timeout /t 3 /nobreak >nul

netstat -ano | findstr ":%PANEL_PORT%" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [ERROR] Gagal start. Cek window "WFLabs-Panel-20110" untuk log error.
  if not "%MODE%"=="--autostart" pause
  exit /b 1
)
echo [OK] Panel berhasil jalan.

:SHOWURLS
echo.
echo  Lokal   : http://127.0.0.1:%PANEL_PORT%
echo  Member  : http://127.0.0.1:%PANEL_PORT%/member
echo  Tailscale (dari rumah/HP):
echo            http://%TAIL_IP%:%PANEL_PORT%
echo            http://%TAIL_IP%:%PANEL_PORT%/member
echo  Folder (Explorer rumah):
echo            \\%TAIL_IP%\router-panel
echo            (fallback admin share: \\%TAIL_IP%\e$\router-panel)
echo.

if "%MODE%"=="--autostart" (
  echo Mode autostart: browser tidak dibuka otomatis.
  exit /b 0
)

echo Membuka browser...
start http://127.0.0.1:%PANEL_PORT%
echo Selesai. Jangan tutup window "WFLabs-Panel-20110" agar panel tetap jalan.
pause
