@echo off
title PJ Music — APK Build
color 0A
echo.
echo  ==========================================
echo   PJ Music App — APK Build Script
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js nahi mila!
    echo.
    echo  Pehle Node.js install karo:
    echo  https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js mila: 
node --version

:: Go to frontend folder
cd /d "%~dp0frontend"
echo.
echo  [1/4] Dependencies install ho rahi hain...
call npm install
if errorlevel 1 goto :error

echo.
echo  [2/4] Android platform check...
if not exist "android" (
    echo  Android platform add ho raha hai...
    call npx cap add android
    if errorlevel 1 goto :error
) else (
    echo  Android platform pehle se hai.
)

echo.
echo  [3/4] Web files sync ho rahi hain...
call npx cap sync android
if errorlevel 1 goto :error

echo.
echo  [4/4] Permissions setup...
node setup-android.js

echo.
echo  ==========================================
echo   DONE! Ab ye karo:
echo  ==========================================
echo.
echo  1. Android Studio mein project kholo:
echo     Folder: %~dp0frontend\android
echo.
echo  2. Gradle sync hone do (2-5 min)
echo.
echo  3. Build menu:
echo     Build ^> Build Bundle(s)/APK(s) ^> Build APK(s)
echo.
echo  4. APK milegi yahan:
echo     android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo  5. APK phone mein transfer karo aur install karo
echo.
pause
goto :eof

:error
echo.
echo  [ERROR] Kuch gadbad ho gayi!
echo  Error message upar dekho aur fix karo.
echo.
pause
exit /b 1
