@echo off
title Export LAN -> Cloud

cd /d X:\X\CHAN\CARO

echo ======================================
echo    EXPORT LAN -> FIREBASE CLOUD
echo ======================================
echo.

echo 1. Export data from Emulator...
echo Y | firebase emulators:export firebase-data --project fake-server --force
if errorlevel 1 (
    echo [ERROR] Export failed
    pause
    exit /b
)

echo.
echo 2. Import data to Firebase Cloud...
echo.

if not exist "src\sync-to-cloud.js" (
    echo [WARNING] sync-to-cloud.js not found
    echo Creating simple sync script...
    echo.
    
    if not exist "firebase-data\database_export\fake-server.json" (
        echo [ERROR] Exported data not found
        pause
        exit /b
    )
    
    echo Using curl to upload to Firebase Cloud...
    curl -X PUT ^
         -H "Content-Type: application/json" ^
         --data-binary @firebase-data\database_export\fake-server.json ^
         "https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app/.json?auth=AIzaSyAM2qB0WixXi-QEPKEvfrpcVPbBqL7FVeU"
) else (
    node src\sync-to-cloud.js
)

echo.
echo ======================================
echo         EXPORT HOAN THANH
echo ======================================
pause
