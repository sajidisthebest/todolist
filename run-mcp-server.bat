@echo off
title TaskFlow Pro - MCP Server
echo ========================================================
echo   Starting TaskFlow Pro MCP Server (SSE + HTTP Sync)
echo   Allows Google Spark, Antigravity, Claude, and AI tools
echo   to orchestrate tasks and sync with the web application.
echo ========================================================
echo.

where py >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Python runtime detected. Launching Python MCP Server...
    py "%~dp0mcp-server\server.py" --sse --port 3333
    goto done
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Python runtime detected. Launching Python MCP Server...
    python "%~dp0mcp-server\server.py" --sse --port 3333
    goto done
)

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js runtime detected. Launching Node.js MCP Server...
    node "%~dp0mcp-server\server.js" --sse --port 3333
    goto done
)

echo [ERROR] Neither Python (py/python) nor Node.js (node) was found in PATH.
echo Please ensure Python 3 or Node.js is installed to run the local MCP Server.
pause

:done
