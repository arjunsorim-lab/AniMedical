@echo off
setlocal enabledelayedexpansion

echo =========================================================
echo  VOXA -- Voice-Enabled AI Automotive Assistant
echo =========================================================

:: -- Check for Python --
where python >nul 2>nul
if %errorlevel% NEQ 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ and add it to your PATH.
    pause
    exit /b 1
)

:: -- Check for Node.js/NPM --
where npm >nul 2>nul
if %errorlevel% NEQ 0 (
    echo [WARNING] NPM not found. The frontend requires Node.js.
    echo Please install Node.js from https://nodejs.org/
    echo.
)

:: -- Start Backend --
echo [1/2] Starting Backend Server...
cd backend
start "VOXA Backend" cmd /k "python main.py"
cd ..

:: -- Start Frontend --
echo [2/2] Starting Frontend (Vite)...
cd frontend
:: Try to install dependencies if node_modules missing
if not exist "node_modules" (
    echo [INFO] node_modules folder is missing. Installing libraries...
    call npm install
)
echo [INFO] Launching frontend server...
start "VOXA Frontend" cmd /k "npm run dev"
cd ..

echo.
echo =========================================================
echo  SERVER STATUS:
echo  - Backend: http://localhost:8000
echo  - Frontend: http://localhost:5173
echo =========================================================
echo.
echo Check the two new windows for any error messages.
echo.
pause
