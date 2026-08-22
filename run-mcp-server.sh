#!/usr/bin/env bash
echo "========================================================"
echo "  Starting TaskFlow Pro MCP Server (SSE + HTTP Sync)"
echo "  Allows Google Spark, Antigravity, Claude, and AI tools"
echo "  to orchestrate tasks and sync with the web application."
echo "========================================================"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if command -v python3 &>/dev/null; then
    echo "[OK] Python 3 detected. Launching Python MCP Server..."
    python3 "$DIR/mcp-server/server.py" --sse --port 3333
elif command -v node &>/dev/null; then
    echo "[OK] Node.js detected. Launching Node.js MCP Server..."
    node "$DIR/mcp-server/server.js" --sse --port 3333
else
    echo "[ERROR] Neither python3 nor node was found in PATH."
    exit 1
fi
