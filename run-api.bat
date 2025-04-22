@echo off
echo ========================================================
echo GPT-SoVITS v3 API Server
echo ========================================================

:: Check for Python runtime
set PYTHON=python
if exist runtime\python.exe (
    set PYTHON=runtime\python.exe
    echo Using bundled Python runtime
) else (
    echo Using system Python - make sure it's in your PATH
)

echo.
echo Starting GPT-SoVITS v3 API server...
echo.
%PYTHON% api_v2.py -a 0.0.0.0 -p 9875

echo.
echo Server stopped. Press any key to exit...
pause