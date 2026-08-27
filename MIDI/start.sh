#!/bin/bash
# Auto-restart wrapper for the MIDI surface server.
# If Node crashes, it restarts within 2 seconds.
# Usage:  ./start.sh    (or double-click in Finder)

cd "$(dirname "$0")"

echo "=========================================="
echo "  iPad MIDI Surface — auto-restart guard"
echo "  Press Ctrl+C to stop."
echo "=========================================="

while true; do
  echo ""
  echo "[guard] Starting server..."
  node server.js
  EXIT_CODE=$?
  echo "[guard] Server exited (code $EXIT_CODE). Restarting in 2s..."
  sleep 2
done
