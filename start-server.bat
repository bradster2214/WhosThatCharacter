@echo off
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in your PATH.
    echo Download it from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo Starting Who's That Character server...
echo Open OBS Browser Source at: http://127.0.0.1:8787/index.html
echo Press Ctrl+C to stop.
echo.
python -m http.server 8787
pause
