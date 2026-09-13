@echo off
title WFLabs - Setup Sekali (Run as Administrator)
cd /d "%~dp0.."

echo ========================================
echo  WFLabs Office PC - Setup Sekali Saja
echo  Klik kanan file ini -^> Run as administrator
echo ========================================
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Bukan admin. Klik kanan -^> Run as administrator.
  pause
  exit /b 1
)

echo [1/3] Membuat SMB share "router-panel"...
net share router-panel /delete /y >nul 2>&1
net share router-panel="E:\router-panel" /GRANT:"IT Support",FULL
if errorlevel 1 (
  echo [WARN] Gagal buat share. Cek manual: klik kanan folder -^> Properties -^> Sharing.
) else (
  echo [OK] Share dibuat: \\%COMPUTERNAME%\router-panel
)

echo.
echo [2/3] Membuka firewall port 20110 (panel web)...
netsh advfirewall firewall delete rule name="WFLabs Panel 20110" >nul 2>&1
netsh advfirewall firewall add rule name="WFLabs Panel 20110" dir=in action=allow protocol=TCP localport=20110 profile=any description="WFLabs 9Router panel via Tailscale/LAN"
if errorlevel 1 (
  echo [WARN] Gagal tambah firewall rule.
) else (
  echo [OK] Firewall port 20110 dibuka.
)

echo.
echo [3/3] Memastikan File and Printer Sharing aktif...
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes >nul 2>&1
echo [OK] Selesai.

echo.
echo Verifikasi:
net share router-panel
echo.
echo Dari rumah (Tailscale ON):
echo   Web    : http://100.96.147.47:20110
echo   Folder : \\100.96.147.47\router-panel
echo.
pause
