#!/usr/bin/env bash
set -e

if command -v python3 &>/dev/null; then
    python3 server.py
elif command -v python &>/dev/null; then
    python server.py
else
    echo "ERROR: Python is not installed or not in your PATH."
    echo "Install it from https://www.python.org/downloads/"
    exit 1
fi
