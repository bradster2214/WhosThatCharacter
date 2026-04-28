@echo off
python3 --version >nul 2>&1
if not errorlevel 1 (
    python3 server.py
    pause
    exit /b 0
)

python --version >nul 2>&1
if not errorlevel 1 (
    python server.py
    pause
    exit /b 0
)

echo ERROR: Python is not installed or not in your PATH.
echo Download it from https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during installation.
pause
exit /b 1
