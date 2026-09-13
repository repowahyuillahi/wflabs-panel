@echo off
title WFLabs Admin Panel Launcher
cd /d "%~dp0"
echo Starting WFLabs Admin Panel...
start /b "" node.exe server.js
timeout /t 2 /nobreak >nul
start http://127.0.0.1:20110
echo Panel running at http://127.0.0.1:20110
