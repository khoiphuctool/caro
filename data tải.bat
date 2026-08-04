@echo off
title Sync Cloud -> Firebase Emulator

cd /d X:\X\CHAN\CARO

echo.
echo ===============================
echo   Sync Cloud -> Emulator
echo ===============================
echo.

if not exist "src\sync-to-emulator.js" (
    echo [ERROR] Khong tim thay src\sync-to-emulator.js
    pause
    exit /b
)

node src\sync-to-emulator.js

echo.
echo ===============================
echo Da ket thuc
echo ===============================
pause