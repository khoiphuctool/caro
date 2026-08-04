@echo off
title Import backup.json -> Firebase Emulator

cd /d X:\X\CHAN\CARO

echo ======================================
echo    IMPORT BACKUP TO FIREBASE EMULATOR
echo ======================================
echo.

if not exist "backup.json" (
    echo [ERROR] Khong tim thay backup.json
    pause
    exit /b
)

echo Dang nap backup.json vao Emulator...
echo.

curl -X PUT ^
     -H "Content-Type: application/json" ^
     --data-binary @backup.json ^
     "http://127.0.0.1:9000/.json?ns=caro-fa824-default-rtdb"

echo.
echo.
echo ======================================
echo         IMPORT HOAN THANH
echo ======================================
pause