@echo off
title CARO LAN SERVER

:MENU
cls
color 07
echo =========================================
echo        CARO LAN SERVER MANAGER
echo =========================================
echo.
echo 1. Start Server
echo 2. Stop Server
echo 3. Check Status
echo 4. Exit
echo.

set /p c=Choose (1-4):

if "%c%"=="1" goto START
if "%c%"=="2" goto STOP
if "%c%"=="3" goto STATUS
if "%c%"=="4" exit

goto MENU

:START
cd /d X:\X\CHAN\CARO
echo Killing existing processes on port 9000...
for /f "tokens=5" %%a in ('netstat -ano ^| find ":9000"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul
if exist firebase-data (
    echo Importing data from firebase-data...
    start "Firebase Emulator" cmd /k firebase emulators:start --only database --project fake-server --import firebase-data
) else (
    echo No existing data found, starting fresh...
    start "Firebase Emulator" cmd /k firebase emulators:start --only database --project fake-server
)
timeout /t 3 >nul
echo Starting auto-save script (every 5 minutes)...
start "Auto-Save" cmd /c :loop && timeout /t 300 && echo Y | firebase emulators:export firebase-data --project fake-server && goto loop
goto STATUS

:STOP
echo.
echo Exporting data before stopping server...
cd /d X:\X\CHAN\CARO
echo Y | firebase emulators:export firebase-data --project fake-server --force
if errorlevel 1 (
    echo.
    echo WARNING: Export failed or was aborted
    echo Data may not be saved properly
    echo.
) else (
    echo.
    echo SUCCESS: Data exported successfully
    echo.
)
taskkill /F /IM java.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo.
echo Server stopped.
pause
goto MENU

:STATUS
cls
echo.
echo Checking server...
echo.

netstat -ano | find ":9000" >nul

if errorlevel 1 (
    color 0C
    echo SERVER OFFLINE
) else (
    color 0A
    echo SERVER ONLINE
)

echo.
pause
goto MENU